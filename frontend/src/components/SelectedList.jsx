import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useInView } from 'react-intersection-observer';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { api } from '../api';

function SortableItem({ item, onUnselect }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 10 : 1,
        position: 'relative',
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            className={`list-item ${isDragging ? 'dragging' : ''}`}
        >
            <span>ID: {item.id}</span>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <span>{item.name}</span>
                <button
                    className="delete-btn"
                    onPointerDown={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                        e.stopPropagation();
                        onUnselect(item.id);
                    }}
                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem', background: '#ef4444', cursor: 'pointer', zIndex: 20, position: 'relative' }}
                >
                    X
                </button>
            </div>
        </div>
    );
}

export function SelectedList({ onItemUnselected }) {
    const [items, setItems] = useState([]);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(false);

    // Track pending unselections to prevent flickering
    const pendingUnselections = useRef(new Set());
    // Track optimistic order
    const optimisticOrder = useRef(null);

    const { ref, inView } = useInView();

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const fetchItems = useCallback(async (reset = false) => {
        if (loading) return;
        setLoading(true);
        try {
            const p = reset ? 1 : page;
            const data = await api.listSelected(p, search);

            // Filter out items that are pending unselection
            let filteredData = data.filter(item => {
                if (pendingUnselections.current.has(item.id)) {
                    return false;
                }
                return true;
            });

            // Check if any pending unselections are NO LONGER in the server response
            // If so, we can stop tracking them
            const serverIds = new Set(data.map(i => i.id));
            for (const id of pendingUnselections.current) {
                if (!serverIds.has(id)) {
                    pendingUnselections.current.delete(id);
                }
            }

            if (reset) {
                // Apply optimistic order if it exists
                if (optimisticOrder.current) {
                    const orderMap = new Map(optimisticOrder.current.map((id, index) => [id, index]));
                    filteredData.sort((a, b) => {
                        const indexA = orderMap.has(a.id) ? orderMap.get(a.id) : Infinity;
                        const indexB = orderMap.has(b.id) ? orderMap.get(b.id) : Infinity;
                        return indexA - indexB;
                    });
                }

                setItems(filteredData);
                setPage(2);
            } else {
                setItems(prev => {
                    // Avoid duplicates if any (though server shouldn't send duplicates)
                    const newItems = filteredData.filter(d => !prev.find(p => p.id === d.id));
                    const combined = [...prev, ...newItems];

                    // Re-sort combined list if we have optimistic order
                    if (optimisticOrder.current) {
                        const orderMap = new Map(optimisticOrder.current.map((id, index) => [id, index]));
                        combined.sort((a, b) => {
                            const indexA = orderMap.has(a.id) ? orderMap.get(a.id) : Infinity;
                            const indexB = orderMap.has(b.id) ? orderMap.get(b.id) : Infinity;
                            return indexA - indexB;
                        });
                    }

                    return combined;
                });
                setPage(p + 1);
            }

            if (data.length < 20) {
                setHasMore(false);
            } else {
                setHasMore(true);
            }
        } catch (error) {
            console.error("Failed to fetch selected items", error);
        } finally {
            setLoading(false);
        }
    }, [page, search, loading]);

    useEffect(() => {
        fetchItems(true);
    }, [search]);

    useEffect(() => {
        if (inView && hasMore && !loading) {
            fetchItems();
        }
    }, [inView, hasMore, loading, fetchItems]);

    // Poll for updates
    useEffect(() => {
        const interval = setInterval(() => {
            // Refetch page 1 to sync state
            if (page === 2 && !search) {
                fetchItems(true);
            }
        }, 1000);
        return () => clearInterval(interval);
    }, [page, search, fetchItems]);

    const handleDragEnd = async (event) => {
        const { active, over } = event;

        if (active.id !== over.id) {
            setItems((items) => {
                const oldIndex = items.findIndex(i => i.id === active.id);
                const newIndex = items.findIndex(i => i.id === over.id);
                const newItems = arrayMove(items, oldIndex, newIndex);

                // Update optimistic order
                optimisticOrder.current = newItems.map(i => i.id);

                // Send new order to server
                // We send the IDs of the currently loaded items in their new order
                api.reorderItems(newItems.map(i => i.id));

                return newItems;
            });
        }
    };

    const handleUnselect = async (id) => {
        const item = items.find(i => i.id === id);
        try {
            // Add to pending unselections
            pendingUnselections.current.add(id);

            setItems(prev => prev.filter(i => i.id !== id));
            if (item && onItemUnselected) {
                onItemUnselected(item);
            }
            await api.unselectItem(id);
        } catch (err) {
            console.error(err);
            // If failed, remove from pending and refetch
            pendingUnselections.current.delete(id);
            fetchItems(true);
        }
    };

    return (
        <div className="panel">
            <div className="panel-header">
                <h2 className="panel-title">Selected Items</h2>
                <div className="controls">
                    <input
                        type="text"
                        placeholder="Filter by ID..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
            </div>
            <div className="list-container">
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                >
                    <SortableContext
                        items={items.map(i => i.id)}
                        strategy={verticalListSortingStrategy}
                    >
                        {items.map(item => (
                            <SortableItem key={item.id} item={item} onUnselect={handleUnselect} />
                        ))}
                    </SortableContext>
                </DndContext>

                {loading && <div className="loading">Loading...</div>}
                {!loading && hasMore && <div ref={ref} className="loading">Scroll for more</div>}
                {!loading && !hasMore && items.length === 0 && <div className="loading">No selected items</div>}
            </div>
        </div>
    );
}
