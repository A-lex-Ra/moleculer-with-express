import React from 'react';
import { AvailableList } from './components/AvailableList';
import { SelectedList } from './components/SelectedList';

function App() {
  return (
    <div className="app-container">
      <AvailableList />
      <SelectedList />
    </div>
  );
}

export default App;
