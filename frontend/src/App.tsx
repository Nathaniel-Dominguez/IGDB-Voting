import { Routes, Route, Navigate } from 'react-router-dom';
import Landing from './components/Landing';
import VotingApp from './components/VotingApp';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/app" element={<VotingApp />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
