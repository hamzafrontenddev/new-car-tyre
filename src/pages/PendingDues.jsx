import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, updateDoc, doc } from 'firebase/firestore';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { CalendarIcon } from '@heroicons/react/24/outline';

const filterByDateRange = (data, start, end) => {
  if (!start || !end) return data;
  return data.filter(item => {
    const itemDate = new Date(item.date);
    return itemDate >= start && itemDate <= end;
  });
};

const PendingDues = () => {
  const [pendingTyres, setPendingTyres] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const itemsPerPage = 5;

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'soldTyres'), (snapshot) => {
      let data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Filter for tyres with due > 0
      data = data.filter(item => parseFloat(item.due || 0) > 0);
      // Apply date range filter
      data = filterByDateRange(data, startDate, endDate);
      setPendingTyres(data);
    });

    return () => unsubscribe();
  }, [startDate, endDate]);

  const handleClearDue = async (tyreId) => {
    try {
      const tyreDoc = doc(db, 'soldTyres', tyreId);
      await updateDoc(tyreDoc, { due: 0 });
      toast.success('Due cleared successfully. Entry removed from list.');
    } catch (error) {
      toast.error('Error clearing due amount');
      console.error(error);
    }
  };

  const filteredTyres = pendingTyres.filter((tyre) =>
    Object.values(tyre).some((val) =>
      String(val).toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredTyres.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredTyres.length / itemsPerPage);

  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  return (
    <div className="max-w-8xl mx-auto p-6 bg-gradient-to-b from-gray-50 to-gray-100 min-h-screen">
      <h2 className="text-3xl font-bold text-gray-800 mb-6 bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
        Pending Dues
      </h2>

      {/* Search and Date Filter */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-6">
        <input
          type="text"
          placeholder="🔍 Search by customer, company, brand..."
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setCurrentPage(1);
          }}
          className="w-full sm:w-1/3 px-4 py-3 border border-gray-200 rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-700 transition duration-200"
        />
        <div className="flex gap-3">
          <div className="relative">
            <DatePicker
              selected={startDate}
              onChange={(date) => setStartDate(date)}
              selectsStart
              startDate={startDate}
              endDate={endDate}
              placeholderText="Start Date"
              className="w-full px-4 py-2 border border-gray-200 rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-700"
              dateFormat="dd/MM/yyyy"
              isClearable
            />
            <CalendarIcon className="w-5 h-5 text-gray-500 absolute right-3 top-1/2 transform -translate-y-1/2" />
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
              className="w-full px-4 py-2 border border-gray-200 rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-700"
              dateFormat="dd/MM/yyyy"
              isClearable
            />
            <CalendarIcon className="w-5 h-5 text-gray-500 absolute right-3 top-1/2 transform -translate-y-1/2" />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-sm text-left bg-white rounded-xl shadow-sm">
          <thead>
            <tr className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
              <th className="py-3 px-6 font-semibold">Customer</th>
              <th className="py-3 px-6 font-semibold">Company</th>
              <th className="py-3 px-6 font-semibold">Brand</th>
              <th className="py-3 px-6 font-semibold">Model</th>
              <th className="py-3 px-6 font-semibold">Size</th>
              <th className="py-3 px-6 font-semibold">Total Price</th>
              <th className="py-3 px-6 font-semibold">Due Amount</th>
              <th className="py-3 px-6 font-semibold">Date</th>
            </tr>
          </thead>
          <tbody>
            {currentItems.length > 0 ? (
              currentItems.map((tyre) => (
                <tr key={tyre.id} className="border-b border-gray-200 hover:bg-gray-50 transition duration-200">
                  <td className="py-3 px-6">{tyre.customerName || 'N/A'}</td>
                  <td className="py-3 px-6">{tyre.company}</td>
                  <td className="py-3 px-6">{tyre.brand}</td>
                  <td className="py-3 px-6">{tyre.model}</td>
                  <td className="py-3 px-6">{tyre.size}</td>
                  <td className="py-3 px-6 text-blue-700 font-semibold">
                    Rs. {(tyre.payableAmount || tyre.price * tyre.quantity).toLocaleString()}
                  </td>
                  <td className="py-3 px-6 text-red-600 font-semibold">
                    Rs. {tyre.due.toLocaleString()}
                  </td>
                  <td className="py-3 px-6">{tyre.date}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="9" className="text-center py-6 text-gray-500">
                  No pending dues found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex justify-center gap-2 mt-4">
        {Array.from({ length: totalPages }, (_, i) => i + 1).map(number => (
          <button
            key={number}
            onClick={() => paginate(number)}
            className={`px-4 py-2 rounded-xl ${
              currentPage === number ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            } transition duration-200`}
          >
            {number}
          </button>
        ))}
      </div>

      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
      />
    </div>
  );
};

export default PendingDues;