import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useInView } from 'react-intersection-observer';
import { api } from '../api';

export function AvailableList() {
    const [items, setItems] = useState([]);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [search, setSearch] = useState('');
    const [newItemId, setNewItemId] = useState('');
    const [loading, setLoading] = useState(false);

    const { ref, inView } = useInView();

    const fetchItems = useCallback(async (reset = false) => {
        if (loading) return;
        setLoading(true);
        try {
            const p = reset ? 1 : page;
            const data = await api.listAvailable(p, search);

            if (reset) {
                setItems(data);
                setPage(2);
            } else {
                setItems(prev => [...prev, ...data]);
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
            // For simplicity, we just re-fetch the current page view or just page 1?
            // Infinite scroll makes polling hard. 
            // But we need to sync "Available" items (some might be selected by others).
            // Let's just re-fetch the current list (or at least the first page) to keep it somewhat in sync.
            // Or better: rely on the user scrolling. 
            // But the requirement says "receiving ... data once a second".
            // Let's re-fetch the first page every second if we are at the top, or just rely on manual actions.
            // Actually, if we just want to update the "Selected" list when we select something, we can use a callback.
            // But for "Available", if someone else selects an item, it should disappear.
            // Let's implement a simple poll for the first page.
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
        try {
            // Optimistic update
            setItems(prev => prev.filter(i => i.id !== id));
            await api.selectItem(id);
            // Trigger global refresh if possible, or just wait for polling in SelectedList
        } catch (err) {
            console.error(err);
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
                {!loading && hasMore && <div ref={ref} className="loading">Scroll for more</div>}
                {!loading && !hasMore && items.length === 0 && <div className="loading">No items found</div>}
            </div>
        </div>
    );
}
