import React from 'react';
import { AvailableList } from './components/AvailableList';
import { SelectedList } from './components/SelectedList';

function App() {
  const availableListRef = React.useRef();
  const selectedListRef = React.useRef();

  const handleItemUnselected = (item) => {
    if (availableListRef.current) {
      availableListRef.current.restoreItem(item);
    }
  };

  const handleItemSelected = (item) => {
    if (selectedListRef.current) {
      selectedListRef.current.addItem(item);
    }
  };

  return (
    <div className="app-container">
      <AvailableList ref={availableListRef} onItemSelected={handleItemSelected} />
      <SelectedList ref={selectedListRef} onItemUnselected={handleItemUnselected} />
    </div>
  );
}

export default App;
