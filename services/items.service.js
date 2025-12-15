"use strict";

module.exports = {
    name: "items",

    settings: {
        // Batching intervals
        addBatchInterval: 10000, // 10 seconds
        actionBatchInterval: 1000, // 1 second
    },

    created() {
        // In-memory storage
        this.allItems = new Map(); // ID -> Item
        this.allIds = []; // Array of IDs, kept sorted
        this.selectedIds = []; // Array of IDs in order

        // Queues
        this.addQueue = new Map(); // ID -> Item (Deduplication by ID)
        this.actionQueue = []; // List of actions { type, payload }

        // Initialize with 1,000,000 items
        this.logger.info("Initializing 1,000,000 items...");
        for (let i = 1; i <= 1000000; i++) {
            this.allItems.set(i, { id: i, name: `Item ${i}` });
            this.allIds.push(i);
        }
        this.logger.info("Initialization complete.");

        // Start batch processors
        this.addBatchTimer = setInterval(() => this.processAddQueue(), this.settings.addBatchInterval);
        this.actionBatchTimer = setInterval(() => this.processActionQueue(), this.settings.actionBatchInterval);
    },

    stopped() {
        clearInterval(this.addBatchTimer);
        clearInterval(this.actionBatchTimer);
    },

    actions: {
        /**
         * Get available items (not selected)
         */
        listAvailable: {
            rest: "GET /available",
            params: {
                page: { type: "number", optional: true, default: 1, convert: true },
                pageSize: { type: "number", optional: true, default: 20, convert: true },
                search: { type: "string", optional: true },
            },
            handler(ctx) {
                const { page, pageSize, search } = ctx.params;
                const selectedSet = new Set(this.selectedIds);

                let result = [];
                let count = 0;
                const skip = (page - 1) * pageSize;
                const limit = pageSize;

                const isMatch = (id) => {
                    if (!search) return true;
                    return String(id).includes(search);
                };

                // Iterate sorted IDs
                for (const id of this.allIds) {
                    if (selectedSet.has(id)) continue;
                    if (!isMatch(id)) continue;

                    if (count < skip) {
                        count++;
                        continue;
                    }

                    const item = this.allItems.get(id);
                    if (item) {
                        result.push(item);
                    }

                    if (result.length >= limit) {
                        break;
                    }
                }

                return result;
            }
        },

        /**
         * Get selected items
         */
        listSelected: {
            rest: "GET /selected",
            params: {
                page: { type: "number", optional: true, default: 1, convert: true },
                pageSize: { type: "number", optional: true, default: 20, convert: true },
                search: { type: "string", optional: true },
            },
            handler(ctx) {
                const { page, pageSize, search } = ctx.params;

                let result = [];
                let skipped = 0;
                let taken = 0;
                const skip = (page - 1) * pageSize;
                const limit = pageSize;

                for (const id of this.selectedIds) {
                    const item = this.allItems.get(id);
                    if (!item) continue;

                    if (search && !String(item.id).includes(search)) continue;

                    if (skipped < skip) {
                        skipped++;
                        continue;
                    }

                    if (taken < limit) {
                        result.push(item);
                        taken++;
                    } else {
                        break;
                    }
                }

                return result;
            }
        },

        /**
         * Queue adding a new item
         */
        addItem: {
            rest: "POST /add",
            params: {
                id: { type: "any" },
            },
            handler(ctx) {
                let { id } = ctx.params;
                // Try to convert to number if possible
                if (!isNaN(Number(id))) {
                    id = Number(id);
                }

                if (this.allItems.has(id)) {
                    throw new Error("Item with this ID already exists");
                }
                // Check queue too
                if (this.addQueue.has(id)) {
                    throw new Error("Item with this ID is already queued");
                }

                this.addQueue.set(id, { id, name: `Item ${id}` });
                return { status: "queued", message: "Item addition queued (will appear in ~10s)" };
            }
        },

        /**
         * Queue selection/unselection/reorder
         */
        modify: {
            rest: "POST /modify",
            params: {
                type: { type: "string", enum: ["select", "unselect", "reorder"] },
                payload: { type: "any" }
            },
            handler(ctx) {
                let payload = ctx.params.payload;

                // Normalize payload IDs
                if (ctx.params.type === 'reorder' && Array.isArray(payload)) {
                    payload = payload.map(id => !isNaN(Number(id)) ? Number(id) : id);
                } else if (!isNaN(Number(payload))) {
                    payload = Number(payload);
                }

                this.actionQueue.push({ type: ctx.params.type, payload: payload });
                return { status: "queued" };
            }
        }
    },

    methods: {
        processAddQueue() {
            if (this.addQueue.size === 0) return;

            this.logger.info(`Processing ${this.addQueue.size} new items...`);
            let added = false;
            for (const item of this.addQueue.values()) {
                if (!this.allItems.has(item.id)) {
                    this.allItems.set(item.id, item);
                    this.allIds.push(item.id);
                    added = true;
                }
            }
            this.addQueue.clear();

            if (added) {
                // Sort IDs to ensure order (e.g. 0 comes before 1)
                this.allIds.sort((a, b) => {
                    if (typeof a === 'number' && typeof b === 'number') return a - b;
                    return String(a).localeCompare(String(b));
                });
            }
        },

        processActionQueue() {
            if (this.actionQueue.length === 0) return;

            this.logger.info(`Processing ${this.actionQueue.length} actions...`);

            const currentActions = [...this.actionQueue];
            this.actionQueue = [];

            for (const action of currentActions) {
                try {
                    if (action.type === "select") {
                        const id = action.payload;
                        if (this.allItems.has(id) && !this.selectedIds.includes(id)) {
                            this.selectedIds.push(id);
                        }
                    } else if (action.type === "unselect") {
                        const id = action.payload;
                        this.selectedIds = this.selectedIds.filter(itemId => itemId !== id);
                    } else if (action.type === "reorder") {
                        const newOrder = action.payload;
                        if (Array.isArray(newOrder)) {
                            const validNewOrder = newOrder.filter(id => this.selectedIds.includes(id));
                            const newSet = new Set(validNewOrder);
                            const missing = this.selectedIds.filter(id => !newSet.has(id));
                            this.selectedIds = [...validNewOrder, ...missing];
                        }
                    }
                } catch (e) {
                    this.logger.error("Error processing action", action, e);
                }
            }
        }
    }
};
