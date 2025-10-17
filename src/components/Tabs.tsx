export interface TabDefinition {
  id: string;
  label: string;
}

interface TabsProps {
  tabs: TabDefinition[];
  activeTab: string;
  onSelect: (id: string) => void;
}

export function Tabs({ tabs, activeTab, onSelect }: TabsProps) {
  return (
    <div className="mb-8 flex flex-wrap gap-2">
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            onClick={() => onSelect(tab.id)}
            className={`rounded-md border px-4 py-2 text-sm font-medium transition ${
              isActive
                ? 'border-green-600 bg-green-600 text-white shadow'
                : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700'
            }`}
            type="button"
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
