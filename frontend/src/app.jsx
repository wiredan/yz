import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import OrderTracking from './components/OrderTracking';
import AdminDashboard from './components/AdminDashboard';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/track-order" element={<OrderTracking />} />
        <Route path="/admin" element={<AdminDashboard />} />
      </Routes>
    </Router>
  );
}

function Home() {
  return (
    <div>
      <h1>Wiredan Marketplace</h1>
      <nav>
        <a href="/track-order">Track Your Order</a>
        <a href="/admin">Admin Panel</a>
      </nav>
    </div>
  );
}

export default App;