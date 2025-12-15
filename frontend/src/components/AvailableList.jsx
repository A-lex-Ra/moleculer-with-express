import React, { useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import { useInView } from 'react-intersection-observer';
import { api } from '../api';

export const AvailableList = forwardRef((props, ref) => {
    const [items, setItems] = useState([]);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [search, setSearch] = useState('');
    const [newItemId, setNewItemId] = useState('');
    const [loading, setLoading] = useState(false);

    // Track items that have been restored locally but maybe not yet confirmed by server
    const optimisticItemsRef = useRef(new Map());
    // Track items that have been selected locally but maybe still returned by server
    const pendingSelections = useRef(new Set());

    const { ref: inViewRef, inView } = useInView();

    useImperativeHandle(ref, () => ({
        restoreItem: (item) => {
            // If we are restoring it, it's no longer a pending selection
            pendingSelections.current.delete(item.id);

            // Add to optimistic storage
            optimisticItemsRef.current.set(item.id, item);

            setItems(prev => {
                if (prev.find(i => i.id === item.id)) return prev;
                const newItems = [...prev, item];
                newItems.sort((a, b) => {
                    if (typeof a.id === 'number' && typeof b.id === 'number') return a.id - b.id;
                    return String(a.id).localeCompare(String(b.id));
                });
                return newItems;
            });
        }
    }));

    const fetchItems = useCallback(async (reset = false) => {
        if (loading) return;
        setLoading(true);
        try {
            const p = reset ? 1 : page;
            let data = await api.listAvailable(p, search);

            // Filter out pending selections
            data = data.filter(item => !pendingSelections.current.has(item.id));

            // Remove items from optimistic map if they are present in the server data
            // (Server has caught up)
            data.forEach(item => {
                if (optimisticItemsRef.current.has(item.id)) {
                    optimisticItemsRef.current.delete(item.id);
                }
            });

            if (reset) {
                // Merge server data with remaining optimistic items
                const optimisticList = Array.from(optimisticItemsRef.current.values());
                // Only include optimistic items that match current search
                // AND are not in pendingSelections
                const filteredOptimistic = optimisticList.filter(item =>
                    (!search || String(item.id).includes(search)) &&
                    !pendingSelections.current.has(item.id)
                );

                // Combine and deduplicate
                const combined = [...data];
                filteredOptimistic.forEach(optItem => {
                    if (!combined.find(i => i.id === optItem.id)) {
                        combined.push(optItem);
                    }
                });

                // Sort
                combined.sort((a, b) => {
                    if (typeof a.id === 'number' && typeof b.id === 'number') return a.id - b.id;
                    return String(a.id).localeCompare(String(b.id));
                });

                setItems(combined);
                setPage(2);
            } else {
                setItems(prev => {
                    // Filter duplicates and pending selections from prev just in case
                    const validPrev = prev.filter(i => !pendingSelections.current.has(i.id));
                    // Append new data
                    return [...validPrev, ...data];
                });
                setPage(p + 1);
            }

            if (data.length < 20) {
                setHasMore(false);
            } else {
                setHasMore(true);
            }
        } catch (error) {
            console.error("Failed to fetch items", error);
        } finally {
            setLoading(false);
        }
    }, [page, search, loading]);

    // Initial load and search change
    useEffect(() => {
        fetchItems(true);
    }, [search]);

    // Infinite scroll
    useEffect(() => {
        if (inView && hasMore && !loading) {
            fetchItems();
        }
    }, [inView, hasMore, loading, fetchItems]);

    // Poll for updates (every 1s as per requirement)
    useEffect(() => {
        const interval = setInterval(() => {
            // Only fetch if we are at the top or if we want to sync
            if (page === 2 && !search) { // Only if we haven't scrolled far
                fetchItems(true);
            }
        }, 1000);
        return () => clearInterval(interval);
    }, [page, search, fetchItems]);

    const handleAddItem = async (e) => {
        e.preventDefault();
        if (!newItemId) return;
        try {
            const res = await api.addItem(newItemId);
            setNewItemId('');
            alert(res.data.message || 'Item queued for addition (wait ~10s)');
        } catch (err) {
            alert(err.response?.data?.message || err.message);
        }
    };

    const handleSelect = async (id) => {
        const item = items.find(i => i.id === id);
        try {
            // Add to pending selections
            pendingSelections.current.add(id);

            // Optimistic update
            setItems(prev => prev.filter(i => i.id !== id));

            if (item && props.onItemSelected) {
                props.onItemSelected(item);
            }

            await api.selectItem(id);
        } catch (err) {
            console.error(err);
            // If failed, remove from pending and refetch
            pendingSelections.current.delete(id);
            fetchItems(true);
        }
    };

    return (
        <div className="panel">
            <div className="panel-header">
                <h2 className="panel-title">Available Items</h2>
                <div className="controls">
                    <input
                        type="text"
                        placeholder="Filter by ID..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <form className="controls" onSubmit={handleAddItem}>
                    <input
                        type="text"
                        placeholder="New Item ID"
                        value={newItemId}
                        onChange={(e) => setNewItemId(e.target.value)}
                    />
                    <button type="submit">Add</button>
                </form>
            </div>
            <div className="list-container">
                {items.map(item => (
                    <div key={item.id} className="list-item" onClick={() => handleSelect(item.id)}>
                        <span>ID: {item.id}</span>
                        <span>{item.name}</span>
                    </div>
                ))}
                {loading && <div className="loading">Loading...</div>}
                {!loading && hasMore && <div ref={inViewRef} className="loading">Scroll for more</div>}
                {!loading && !hasMore && items.length === 0 && <div className="loading">No items found</div>}
            </div>
        </div>
    );
});
