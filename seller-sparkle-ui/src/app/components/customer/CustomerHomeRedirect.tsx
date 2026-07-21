import { Navigate } from "react-router-dom";

/** Customer home is Browse for guests and signed-in users (Dashboard kept but hidden from nav). */
function CustomerHomeRedirect() {
  return <Navigate to="/customer/shop" replace />;
}

export default CustomerHomeRedirect;
