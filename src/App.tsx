import { useStore } from './store/store';
import { Auth } from './components/Auth';
import { Chat } from './components/Chat';

function App() {
  const isAuthenticated = useStore((state) => state.isAuthenticated);

  return (
    <>
      {isAuthenticated ? <Chat /> : <Auth />}
    </>
  );
}

export default App;
