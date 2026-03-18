import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ToastProvider } from './components/Toast';
import CreateTrip from './pages/CreateTrip';
import TripView from './pages/TripView';
import CheckinPage from './pages/CheckinPage';

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <Routes>
          <Route path="/" element={<CreateTrip />} />
          <Route path="/:slug" element={<TripView />} />
          <Route path="/:slug/checkin" element={<CheckinPage />} />
        </Routes>
      </ToastProvider>
    </BrowserRouter>
  );
}
