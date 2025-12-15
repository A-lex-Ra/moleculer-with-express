import React from 'react';
import { AvailableList } from './components/AvailableList';
import { SelectedList } from './components/SelectedList';

function App() {
  const availableListRef = React.useRef();

  const handleItemUnselected = (item) => {
    if (availableListRef.current) {
      availableListRef.current.restoreItem(item);
    }
  };

  return (
    <div className="app-container">
      <AvailableList ref={availableListRef} />
      <SelectedList onItemUnselected={handleItemUnselected} />
    </div>
  );
}

export default App;
