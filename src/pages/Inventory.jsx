import React, { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { GiFlatTire } from "react-icons/gi";
import { FaRupeeSign } from "react-icons/fa6";
import {
  HomeIcon,
  CurrencyRupeeIcon,
  ChartBarIcon,
  TruckIcon,
  CubeIcon,
  CalendarIcon,
  BanknotesIcon,
} from "@heroicons/react/24/outline";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

// Helper for filtering by custom date range
const filterByDateRange = (data, start, end) => {
  if (!start || !end) return data;
  return data.filter(item => {
    const itemDate = new Date(item.date);
    return itemDate >= start && itemDate <= end;
  });
};

const Dashboard = () => {
  const [buyData, setBuyData] = useState([]);
  const [sellData, setSellData] = useState([]);
  const [returnData, setReturnData] = useState([]);
  const [stockSummary, setStockSummary] = useState([]);
  const [selectedBrand, setSelectedBrand] = useState("");
  const [brandOptions, setBrandOptions] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    const buyUnsub = onSnapshot(collection(db, "purchasedTyres"), (snapshot) => {
      const buyList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setBuyData(buyList);
    });

    const sellUnsub = onSnapshot(collection(db, "soldTyres"), (snapshot) => {
      const sellList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSellData(sellList);
    });

    const returnUnsub = onSnapshot(collection(db, "returnedTyres"), (snapshot) => {
      const returnList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setReturnData(returnList);
    });

    return () => {
      buyUnsub();
      sellUnsub();
      returnUnsub();
    };
  }, []);

  useEffect(() => {
    const allBrands = new Set(buyData.map(item => item.brand));
    setBrandOptions(Array.from(allBrands));
  }, [buyData]);

  useEffect(() => {
    // Wait for buyData to load to avoid race conditions
    if (!buyData.length) return;

    let filteredBuy = [...buyData];
    let filteredSell = [...sellData];
    let filteredReturns = [...returnData];

    if (startDate && endDate) {
      filteredBuy = filterByDateRange(filteredBuy, startDate, endDate);
      filteredSell = filterByDateRange(filteredSell, startDate, endDate);
      filteredReturns = filterByDateRange(filteredReturns, startDate, endDate);
    }

    if (selectedDate) {
      filteredBuy = filteredBuy.filter(item => {
        const itemDate = new Date(item.date);
        return itemDate.toDateString() === new Date(selectedDate).toDateString();
      });
      filteredSell = filteredSell.filter(item => {
        const itemDate = new Date(item.date);
        return itemDate.toDateString() === new Date(selectedDate).toDateString();
      });
      filteredReturns = filteredReturns.filter(item => {
        const itemDate = new Date(item.date);
        return itemDate.toDateString() === new Date(selectedDate).toDateString();
      });
    }

    if (selectedBrand) {
      filteredBuy = filteredBuy.filter(item => item.brand === selectedBrand);
      filteredSell = filteredSell.filter(item => item.brand === selectedBrand);
      filteredReturns = filteredReturns.filter(item => item.brand === selectedBrand);
    }

    const map = new Map();

    // Initialize with buy data
    filteredBuy.forEach((item) => {
      const key = `${(item.company || "N/A").toLowerCase()}_${item.brand?.toLowerCase() || "N/A"}_${item.size?.toLowerCase() || "N/A"}_${(item.model || "N/A").toLowerCase()}`;
      const entry = map.get(key) || {
        company: item.company || "N/A",
        brand: item.brand || "N/A",
        size: item.size || "N/A",
        model: item.model || "N/A",
        bought: 0,
        sold: 0,
        returned: 0,
        store: 0,
        shop: 0,
        latestDate: item.date ? new Date(item.date) : new Date(0),
      };
      entry.bought += parseInt(item.quantity, 10) || 0;
      entry.store += parseInt(item.store, 10) || 0;
      entry.shop += parseInt(item.shop, 10) || 0; // Accumulate shop quantity directly from buyData
      entry.latestDate = new Date(Math.max(new Date(item.date).getTime(), entry.latestDate.getTime()));
      map.set(key, entry);
    });

    // Process sales
    filteredSell.forEach((item) => {
      const key = `${(item.company || "N/A").toLowerCase()}_${item.brand?.toLowerCase() || "N/A"}_${item.size?.toLowerCase() || "N/A"}_${(item.model || "N/A").toLowerCase()}`;
      let entry = map.get(key);
      if (!entry) {
        entry = {
          company: item.company || "N/A",
          brand: item.brand || "N/A",
          size: item.size || "N/A",
          model: item.model || "N/A",
          bought: 0,
          sold: 0,
          returned: 0,
          store: 0,
          shop: 0,
          latestDate: item.date ? new Date(item.date) : new Date(0),
        };
      }
      const soldQty = parseInt(item.quantity, 10) || 0;
      entry.sold += soldQty;
      // Removed manual shop deduction since it's already updated in purchasedTyres
      entry.latestDate = new Date(Math.max(new Date(item.date).getTime(), entry.latestDate.getTime()));
      map.set(key, entry);
    });

    // Process returns
    filteredReturns.forEach((item) => {
      const key = `${(item.company || "N/A").toLowerCase()}_${item.brand?.toLowerCase() || "N/A"}_${item.size?.toLowerCase() || "N/A"}_${(item.model || "N/A").toLowerCase()}`;
      let entry = map.get(key);
      if (!entry) {
        entry = {
          company: item.company || "N/A",
          brand: item.brand || "N/A",
          size: item.size || "N/A",
          model: item.model || "N/A",
          bought: 0,
          sold: 0,
          returned: 0,
          store: 0,
          shop: 0,
          latestDate: item.date ? new Date(item.date) : new Date(0),
        };
      }
      const returnQty = parseInt(item.returnQuantity, 10) || 0;
      entry.returned += returnQty;
      entry.sold = Math.max(entry.sold - returnQty, 0);
      // Removed manual shop addition since it's already updated in purchasedTyres
      entry.latestDate = new Date(Math.max(new Date(item.date).getTime(), entry.latestDate.getTime()));
      map.set(key, entry);
    });

    let summary = Array.from(map.values()).map(item => ({
      ...item,
      stock: Math.max(item.bought - item.sold, 0),
    }));

    // Sort summary by latestDate in descending order (latest first), with fallback for missing dates
    summary.sort((a, b) => {
      const dateA = a.latestDate ? new Date(a.latestDate) : new Date(0);
      const dateB = b.latestDate ? new Date(b.latestDate) : new Date(0);
      return dateB.getTime() - dateA.getTime();
    });

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      summary = summary.filter(item =>
        item.company?.toLowerCase().includes(query) ||
        item.brand?.toLowerCase().includes(query) ||
        item.size?.toLowerCase().includes(query) ||
        item.model?.toLowerCase().includes(query)
      );
    }

    setStockSummary(summary);
  }, [buyData, sellData, returnData, selectedBrand, startDate, endDate, selectedDate, searchQuery]);

  const totalBought = stockSummary.reduce((sum, item) => sum + item.bought, 0);
  const totalSold = stockSummary.reduce((sum, item) => sum + item.sold, 0);
  const totalReturned = stockSummary.reduce((sum, item) => sum + item.returned, 0);
  const availableStock = stockSummary.reduce((sum, item) => sum + item.stock, 0);
  const totalStore = buyData
    .filter(item => item.brand === selectedBrand || !selectedBrand)
    .reduce((sum, item) => sum + (parseInt(item.store, 10) || 0), 0);
  const totalShop = buyData
    .filter(item => item.brand === selectedBrand || !selectedBrand)
    .reduce((sum, item) => sum + (parseInt(item.shop, 10) || 0), 0);

  const totalBuyCost = buyData
    .filter(item => item.brand === selectedBrand || !selectedBrand)
    .reduce((sum, item) => sum + (parseFloat(item.price) * parseInt(item.quantity, 10) || 0), 0);

  const totalSales = sellData
    .filter(item => item.brand === selectedBrand || !selectedBrand)
    .reduce((sum, item) => sum + (parseFloat(item.price) * parseInt(item.quantity, 10) || 0), 0);

  const totalReturnAmount = returnData
    .filter(item => item.brand === selectedBrand || !selectedBrand)
    .reduce((sum, item) => sum + (parseFloat(item.returnPrice) * parseInt(item.returnQuantity, 10) || 0), 0);

  const adjustedTotalSales = totalSales - totalReturnAmount;
  const profit = adjustedTotalSales - totalBuyCost;

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = stockSummary.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(stockSummary.length / itemsPerPage);

  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
        <div>
          <h2 className="text-3xl font-bold text-gray-800">📊 Inventory Dashboard</h2>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          <div className="relative">
            <input
              type="text"
              placeholder="Search brand, size, model, company..."
              className="border px-10 py-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-400 w-64"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <span className="absolute left-3 top-2.5 text-gray-400">🔍</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
        <StatCard title="Total Buy Product" value={totalBought} icon={<GiFlatTire className="w-8 h-8 text-blue-600" />} />
        <StatCard title="Total Sold" value={totalSold} icon={<TruckIcon className="w-8 h-8 text-green-600" />} />
        <StatCard title="Available Stock" value={availableStock} icon={<CubeIcon className="w-8 h-8 text-yellow-500" />} />
        <StatCard title="Total Store Quantity" value={totalStore} icon={<HomeIcon className="w-8 h-8 text-purple-600" />} />
        <StatCard title="Total Shop Quantity" value={totalShop} icon={<CubeIcon className="w-8 h-8 text-purple-600" />} />
        <StatCard title="Total Buy Cost" value={`Rs. ${totalBuyCost.toLocaleString()}`} icon={<FaRupeeSign className="w-8 h-8 text-purple-600" />} />
        <StatCard title="Total Sales" value={`Rs. ${adjustedTotalSales.toLocaleString()}`} icon={<ChartBarIcon className="w-8 h-8 text-teal-600" />} />
        <StatCard title="Profit" value={`Rs. ${profit.toLocaleString()}`} icon={<BanknotesIcon className="w-8 h-8 text-green-600" />} />
      </div>

      <div className="flex flex-wrap items-center gap-4 mb-4">
        <select
          className="border px-4 py-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
          value={selectedBrand}
          onChange={(e) => setSelectedBrand(e.target.value)}
        >
          <option value="">All Brands</option>
          {brandOptions.map((brand, idx) => (
            <option key={idx} value={brand}>{brand}</option>
          ))}
        </select>
        <div className="flex gap-2">
          <div className="relative">
            <DatePicker
              selected={startDate}
              onChange={(date) => setStartDate(date)}
              selectsStart
              startDate={startDate}
              endDate={endDate}
              placeholderText="Start Date"
              className="border pl-10 pr-3 py-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
              dateFormat="dd/MM/yyyy"
              isClearable
            />
            <CalendarIcon className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" />
          </div>
          <div className="relative">
            <DatePicker
              selected={endDate}
              onChange={(date) => setEndDate(date)}
              selectsEnd
              startDate={startDate}
              endDate={endDate}
              minDate={startDate}
              placeholderText="End Date"
              className="border pl-10 pr-3 py-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
              dateFormat="dd/MM/yyyy"
              isClearable
            />
            <CalendarIcon className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <h3 className="text-xl font-semibold p-4 border-b">🧾 Stock Summary</h3>
        <table className="min-w-full text-sm">
          <thead className="bg-gray-100 text-left">
            <tr>
              <th className="p-3 font-medium">Party</th>
              <th className="p-3 font-medium">Brand</th>
              <th className="p-3 font-medium">Size</th>
              <th className="p-3 font-medium">Model</th>
              <th className="p-3 font-medium">Total Buy</th>
              <th className="p-3 font-medium">Store</th>
              <th className="p-3 font-medium">Shop</th>
              <th className="p-3 font-medium">Sold</th>
              <th className="p-3 font-medium">Returned</th>
              <th className="p-3 font-medium">Available</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {currentItems.length > 0 ? (
              currentItems.map((item, idx) => (
                <tr key={idx} className="hover:bg-gray-50 transition">
                  <td className="p-3">{item.company}</td>
                  <td className="p-3">{item.brand}</td>
                  <td className="p-3">{item.size}</td>
                  <td className="p-3">{item.model}</td>
                  <td className="p-3">{item.bought}</td>
                  <td className="p-3">{item.store}</td>
                  <td className="p-3">{item.shop}</td>
                  <td className="p-3">{item.sold}</td>
                  <td className="p-3">{item.returned}</td>
                  <td className="p-3 font-semibold text-gray-800">{item.stock}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="10" className="text-center py-6 text-gray-500">No data found.</td>
              </tr>
            )}
          </tbody>
        </table>
        <div className="p-4 flex justify-center gap-2">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(number => (
            <button
              key={number}
              onClick={() => paginate(number)}
              className={`px-3 py-1 rounded ${currentPage === number ? 'bg-blue-600 text-white' : 'bg-gray-200 hover:bg-gray-300'}`}
            >
              {number}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ title, value, icon }) => (
  <div className="bg-white shadow rounded-lg p-5 flex items-center gap-4">
    <div className="p-3 bg-gray-100 rounded-full">{icon}</div>
    <div>
      <p className="text-sm text-gray-500">{title}</p>
      <p className="text-xl font-bold text-gray-800">{value}</p>
    </div>
  </div>
);

export default Dashboard;