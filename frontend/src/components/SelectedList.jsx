import React, { useState, useEffect, useCallback } from 'react';
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
                    onClick={(e) => {
                        e.stopPropagation(); // Prevent drag start
                        onUnselect(item.id);
                    }}
                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem', background: '#ef4444' }}
                >
                    X
                </button>
            </div>
        </div>
    );
}

export function SelectedList() {
    const [items, setItems] = useState([]);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(false);

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

            if (reset) {
                setItems(data);
                setPage(2);
            } else {
                setItems(prev => {
                    // Avoid duplicates if any (though server shouldn't send duplicates)
                    const newItems = data.filter(d => !prev.find(p => p.id === d.id));
                    return [...prev, ...newItems];
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

                // Send new order to server
                // We send the IDs of the currently loaded items in their new order
                api.reorderItems(newItems.map(i => i.id));

                return newItems;
            });
        }
    };

    const handleUnselect = async (id) => {
        try {
            setItems(prev => prev.filter(i => i.id !== id));
            await api.unselectItem(id);
        } catch (err) {
            console.error(err);
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
