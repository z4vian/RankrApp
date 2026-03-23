import { createContext, ReactNode, useContext, useState } from 'react';

type ActiveList = {
  id: string;
  title: string;
  category: string;
} | null;

type ListContextType = {
  activeList: ActiveList;
  setActiveList: (list: ActiveList) => void;
};

const ListContext = createContext<ListContextType>({
  activeList: null,
  setActiveList: () => {},
});

export function ListProvider({ children }: { children: ReactNode }) {
  const [activeList, setActiveList] = useState<ActiveList>(null);
  return (
    <ListContext.Provider value={{ activeList, setActiveList }}>
      {children}
    </ListContext.Provider>
  );
}

export const useActiveList = () => useContext(ListContext);