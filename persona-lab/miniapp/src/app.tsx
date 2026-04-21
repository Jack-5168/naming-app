import { createPinia } from 'pinia';
import './app.css';

const App = ({ children }) => {
  const pinia = createPinia();
  
  return pinia.provider(null, children);
};

export default App;
