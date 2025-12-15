import axios from 'axios';

const API_URL = 'http://localhost:3000/api';

export const api = {
    listAvailable: async (page = 1, search = '') => {
        const response = await axios.get(`${API_URL}/items/available`, {
            params: { page, pageSize: 20, search }
        });
        return response.data;
    },

    listSelected: async (page = 1, search = '') => {
        const response = await axios.get(`${API_URL}/items/selected`, {
            params: { page, pageSize: 20, search }
        });
        return response.data;
    },

    addItem: async (id) => {
        return axios.post(`${API_URL}/items/add`, { id });
    },

    selectItem: async (id) => {
        return axios.post(`${API_URL}/items/modify`, { type: 'select', payload: id });
    },

    unselectItem: async (id) => {
        return axios.post(`${API_URL}/items/modify`, { type: 'unselect', payload: id });
    },

    reorderItems: async (ids) => {
        return axios.post(`${API_URL}/items/modify`, { type: 'reorder', payload: ids });
    }
};
