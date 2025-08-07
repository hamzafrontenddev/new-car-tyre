import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot } from 'firebase/firestore';
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
  const [pendingCustomers, setPendingCustomers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const itemsPerPage = 150;

  useEffect(() => {
    let usersMap = {};
    let customerDetailsMap = {};
    let unsubscribeUsers, unsubscribeCustomers, unsubscribeSales;

    unsubscribeUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      usersMap = snapshot.docs.reduce((map, doc) => {
        const data = doc.data();
        if (data.userType === 'Customer') {
          map[data.name.toLowerCase()] = data.mobile || 'N/A';
        }
        return map;
      }, {});

      unsubscribeCustomers = onSnapshot(collection(db, 'customerDetails'), (snapshot) => {
        customerDetailsMap = snapshot.docs.reduce((map, doc) => {
          const data = doc.data();
          map[data.customerName.toLowerCase()] = {
            id: doc.id,
            totalPaid: parseFloat(data.totalPaid) || 0,
            due: parseFloat(data.due) || 0,
          };
          return map;
        }, {});

        unsubscribeSales = onSnapshot(collection(db, 'soldTyres'), (salesSnapshot) => {
          const salesSummary = salesSnapshot.docs.reduce((acc, doc) => {
            const data = doc.data();
            const customerName = (data.customerName || 'N/A').toLowerCase();
            // Use (price - discount) * quantity for totalCost
            const price = parseFloat(data.price) || 0;
            const discount = parseFloat(data.discount) || 0;
            const quantity = parseInt(data.quantity) || 0;
            const totalCost = (price - discount) * quantity;
            const saleKey = `${doc.id}-${customerName}-${data.date || ''}`;

            if (!acc[customerName]) {
              acc[customerName] = {
                totalCost: 0,
                date: data.date,
                earliestDate: data.date ? new Date(data.date) : new Date(),
                sales: new Set(),
              };
            }

            if (!acc[customerName].sales.has(saleKey)) {
              acc[customerName].sales.add(saleKey);
              acc[customerName].totalCost += totalCost;
              if (data.date && new Date(data.date) < acc[customerName].earliestDate) {
                acc[customerName].earliestDate = new Date(data.date);
                acc[customerName].date = data.date;
              }
            }

            return acc;
          }, {});

          const combinedData = Object.keys(salesSummary).map(customerName => {
            const customerDetail = customerDetailsMap[customerName] || { totalPaid: 0, due: 0 };
            const totalCost = salesSummary[customerName].totalCost || 0;
            const totalPaid = customerDetail.totalPaid; // Directly fetch from customerDetails
            const due = Math.max(0, totalCost - totalPaid); // Accurate due calculation

            if (due <= 0) return null; // Exclude if no pending dues

            return {
              id: customerDetail.id || customerName,
              customerName: customerName.charAt(0).toUpperCase() + customerName.slice(1),
              totalCost: totalCost.toFixed(2),
              totalPaid: totalPaid.toFixed(2),
              due: due.toFixed(2),
              date: salesSummary[customerName].date || new Date().toISOString().split('T')[0],
              phone: usersMap[customerName] || 'N/A',
            };
          }).filter(item => item !== null);

          const filteredData = filterByDateRange(combinedData, startDate, endDate);
          setPendingCustomers(filteredData);
        }, (error) => {
          console.error("Error fetching sales data:", error);
          toast.error("Failed to load sales data: " + error.message);
        });
      }, (error) => {
        console.error("Error fetching customer details:", error);
        toast.error("Failed to load customer details: " + error.message);
      });
    }, (error) => {
      console.error("Error fetching users:", error);
      toast.error("Failed to load users: " + error.message);
    });

    return () => {
      if (unsubscribeUsers) unsubscribeUsers();
      if (unsubscribeCustomers) unsubscribeCustomers();
      if (unsubscribeSales) unsubscribeSales();
    };
  }, [startDate, endDate]);

  const filteredCustomers = pendingCustomers.filter((customer) =>
    Object.values({
      customerName: customer.customerName,
      phone: customer.phone,
      totalCost: customer.totalCost,
      totalPaid: customer.totalPaid,
      due: customer.due,
    }).some((val) =>
      String(val).toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredCustomers.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredCustomers.length / itemsPerPage);

  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  return (
    <div className="max-w-8xl mx-auto p-6 bg-gradient-to-b from-gray-50 to-gray-100 min-h-screen">
      <h2 className="text-3xl font-bold mb-6 bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
        Customer Pending Dues
      </h2>

      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-6">
        <input
          type="text"
          placeholder="🔍 Search by customer, phone, cost, paid, due..."
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

      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-sm text-left bg-white rounded-xl shadow-sm">
          <thead>
            <tr className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
              <th className="py-3 px-6 font-semibold">Customer Name</th>
              <th className="py-3 px-6 font-semibold">Phone Number</th>
              <th className="py-3 px-6 font-semibold">Total Cost</th>
              <th className="py-3 px-6 font-semibold">Total Paid</th>
              <th className="py-3 px-6 font-semibold">Pending Dues</th>
              <th className="py-3 px-6 font-semibold">Date</th>
            </tr>
          </thead>
          <tbody>
            {currentItems.length > 0 ? (
              currentItems.map((customer) => (
                <tr key={customer.id} className="border-b border-gray-200 hover:bg-gray-50 transition duration-200">
                  <td className="py-3 px-6">{customer.customerName}</td>
                  <td className="py-3 px-6">{customer.phone}</td>
                  <td className="py-3 px-6 text-green-700 font-semibold">
                    Rs. {parseFloat(customer.totalCost).toLocaleString()}
                  </td>
                  <td className="py-3 px-6 text-green-700 font-semibold">
                    Rs. {parseFloat(customer.totalPaid).toLocaleString()}
                  </td>
                  <td className="py-3 px-6 text-red-600 font-semibold">
                    Rs. {parseFloat(customer.due).toLocaleString()}
                  </td>
                  <td className="py-3 px-6">{customer.date}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="6" className="text-center py-6 text-gray-500">
                  No pending dues found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

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