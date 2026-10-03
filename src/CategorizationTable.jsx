import React, { useState, useMemo } from 'react';

const INITIAL_ITEMS = [
  { id: 1, name: 'Servicios de AWS - Producción', amount: 1450.00, currentCategory: 'Infraestructura', date: '2026-03-01' },
  { id: 2, name: 'Suscripción GitHub Enterprise', amount: 250.00, currentCategory: 'Herramientas', date: '2026-03-02' },
  { id: 3, name: 'Campaña Google Ads Q1', amount: 1200.00, currentCategory: 'Marketing', date: '2026-03-05' },
  { id: 4, name: 'Licencias Adobe Creative Cloud', amount: 80.00, currentCategory: 'Sin Categorizar', date: '2026-03-06' },
  { id: 5, name: 'Café y Snacks Oficina', amount: 45.50, currentCategory: 'Operaciones', date: '2026-03-08' },
  { id: 6, name: 'Hosting Vercel Pro', amount: 20.00, currentCategory: 'Infraestructura', date: '2026-03-10' },
  { id: 7, name: 'Reembolso Viaje Cliente', amount: 310.00, currentCategory: 'Sin Categorizar', date: '2026-03-12' },
];

const AVAILABLE_CATEGORIES = ['Sin Categorizar', 'Infraestructura', 'Herramientas', 'Marketing', 'Operaciones'];

export default function CategorizationTable() {
  const [items, setItems] = useState(INITIAL_ITEMS);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [filterCategory, setFilterCategory] = useState('Todas');
  const [searchTerm, setSearchTerm] = useState('');
  const [bulkCategory, setBulkCategory] = useState('');

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesCategory = filterCategory === 'Todas' || item.currentCategory === filterCategory;
      const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [items, filterCategory, searchTerm]);

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      const visibleIds = filteredItems.map((item) => item.id);
      setSelectedIds(new Set(visibleIds));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectItem = (id) => {
    const nextSelected = new Set(selectedIds);
    if (nextSelected.has(id)) {
      nextSelected.delete(id);
    } else {
      nextSelected.add(id);
    }
    setSelectedIds(nextSelected);
  };

  const handleUpdateCategory = (id, newCategory) => {
    setItems((prevItems) =>
      prevItems.map((item) => (item.id === id ? { ...item, currentCategory: newCategory } : item))
    );
  };

  const handleBulkCategorize = () => {
    if (!bulkCategory || selectedIds.size === 0) return;
    setItems((prevItems) =>
      prevItems.map((item) =>
        selectedIds.has(item.id) ? { ...item, currentCategory: bulkCategory } : item
      )
    );
    setSelectedIds(new Set());
    setBulkCategory('');
  };

  const isAllSelected = filteredItems.length > 0 && selectedIds.size === filteredItems.length;
  const isSomeSelected = selectedIds.size > 0 && selectedIds.size < filteredItems.length;

  return (
    <div className="p-6 bg-gray-50 min-h-screen font-sans text-gray-800">
      <div className="max-w-6xl mx-auto bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
        <div className="p-5 border-b border-gray-200 bg-gray-50 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Tabla de Categorización</h1>
            <p className="text-sm text-gray-500 mt-1">Clasifica y organiza tus transacciones pendientes de forma individual o masiva.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="text"
              placeholder="Buscar transacción..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="Todas">Todas las categorías</option>
              {AVAILABLE_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>

        {selectedIds.size > 0 && (
          <div className="bg-blue-50 border-b border-blue-100 px-5 py-3 flex items-center justify-between text-blue-900 text-sm">
            <div className="flex items-center gap-2 font-medium">
              <span>⚡ {selectedIds.size} elementos seleccionados</span>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={bulkCategory}
                onChange={(e) => setBulkCategory(e.target.value)}
                className="px-2 py-1 text-xs border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-800"
              >
                <option value="">Seleccionar categoría destino...</option>
                {AVAILABLE_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
              <button
                onClick={handleBulkCategorize}
                disabled={!bulkCategory}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                  bulkCategory ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                Aplicar a bloque
              </button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-100 text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">
                <th className="py-3 px-4 w-12 text-center">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    ref={(el) => { if (el) el.indeterminate = isSomeSelected; }}
                    onChange={handleSelectAll}
                    className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer w-4 h-4"
                  />
                </th>
                <th className="py-3 px-4">Fecha</th>
                <th className="py-3 px-4">Descripción de Transacción</th>
                <th className="py-3 px-4 text-right">Monto</th>
                <th className="py-3 px-4 pl-8">Categoría Actual</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 text-sm">
              {filteredItems.length > 0 ? (
                filteredItems.map((item) => {
                  const isChecked = selectedIds.has(item.id);
                  return (
                    <tr key={item.id} className={`hover:bg-gray-50 transition-colors ${isChecked ? 'bg-blue-50/40 hover:bg-blue-50/60' : ''}`}>
                      <td className="py-3 px-4 text-center">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleSelectItem(item.id)}
                          className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer w-4 h-4"
                        />
                      </td>
                      <td className="py-3 px-4 text-gray-500 whitespace-nowrap">{item.date}</td>
                      <td className="py-3 px-4 font-medium text-gray-900">{item.name}</td>
                      <td className="py-3 px-4 text-right font-mono font-semibold text-gray-900">\${item.amount.toFixed(2)}</td>
                      <td className="py-3 px-4 pl-8">
                        <select
                          value={item.currentCategory}
                          onChange={(e) => handleUpdateCategory(item.id, e.target.value)}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium border focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer transition-all ${
                            item.currentCategory === 'Sin Categorizar' ? 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100' :
                            item.currentCategory === 'Infraestructura' ? 'bg-purple-50 text-purple-800 border-purple-200 hover:bg-purple-100' :
                            item.currentCategory === 'Herramientas' ? 'bg-indigo-50 text-indigo-800 border-indigo-200 hover:bg-indigo-100' :
                            item.currentCategory === 'Marketing' ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100' :
                            'bg-slate-50 text-slate-800 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {AVAILABLE_CATEGORIES.map((cat) => (
                            <option key={cat} value={cat} className="text-gray-900 bg-white">{cat}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="5" className="py-10 text-center text-gray-400">No se encontraron transacciones.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="p-4 bg-gray-50 border-t border-gray-200 text-xs text-gray-500 flex justify-between items-center">
          <span>Mostrando {filteredItems.length} de {items.length} transacciones</span>
          <span className="font-semibold text-gray-700">Sin categorizar: {items.filter(i => i.currentCategory === 'Sin Categorizar').length}</span>
        </div>
      </div>
    </div>
  );
}
