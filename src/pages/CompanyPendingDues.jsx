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

const CompanyPendingDues = () => {
  const [pendingCompanies, setPendingCompanies] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const itemsPerPage = 30;

  useEffect(() => {
    let usersMap = {};
    let unsubscribeUsers, unsubscribeLedger, unsubscribePurchases;

    // Fetch users for phone numbers
    unsubscribeUsers = onSnapshot(
      collection(db, 'users'),
      (snapshot) => {
        usersMap = snapshot.docs.reduce((map, doc) => {
          const data = doc.data();
          if (data.userType === 'Company') {
            map[data.name.toLowerCase()] = data.mobile;
          }
          return map;
        }, {});
      },
      (error) => {
        console.error('Error fetching users:', error);
        toast.error('Failed to fetch user data');
      }
    );

    // Fetch companyLedgerEntries for totalPaid
    unsubscribeLedger = onSnapshot(
      collection(db, 'companyLedgerEntries'),
      (ledgerSnapshot) => {
        const ledgerData = ledgerSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          date: doc.data().date?.toDate ? doc.data().date.toDate() : new Date(doc.data().date || Date.now()),
        }));

        // Fetch purchases to calculate totalCost
        unsubscribePurchases = onSnapshot(
          collection(db, 'purchasedTyres'),
          (purchasesSnapshot) => {
            // Aggregate purchases by company
            const purchaseSummary = purchasesSnapshot.docs.reduce((acc, doc) => {
              const data = doc.data();
              const companyName = (data.company || 'N/A').toLowerCase();
              const totalCost = parseFloat(data.totalPrice) || (parseFloat(data.price) || 0) * (parseInt(data.quantity) || 0);
              const date = data.date ? new Date(data.date) : new Date();

              if (!acc[companyName]) {
                acc[companyName] = {
                  totalCost: 0,
                  date: date.toISOString().split('T')[0],
                  earliestDate: date,
                };
              }
              acc[companyName].totalCost += totalCost;
              if (date < acc[companyName].earliestDate) {
                acc[companyName].earliestDate = date;
                acc[companyName].date = date.toISOString().split('T')[0];
              }
              return acc;
            }, {});

            // Aggregate totalPaid from companyLedgerEntries
            const ledgerSummary = ledgerData.reduce((acc, entry) => {
              const companyName = (entry.companyName || 'N/A').toLowerCase();
              if (!acc[companyName]) {
                acc[companyName] = { totalPaid: 0 };
              }
              acc[companyName].totalPaid += parseFloat(entry.credit) || 0;
              return acc;
            }, {});

            // Combine data
            const combinedData = Object.keys(purchaseSummary).map(companyName => {
              const totalCost = purchaseSummary[companyName].totalCost || 0;
              const totalPaid = ledgerSummary[companyName]?.totalPaid || 0;
              const due = totalCost - totalPaid;
              return {
                id: companyName,
                companyName: companyName.charAt(0).toUpperCase() + companyName.slice(1), // Capitalize for display
                totalCost: totalCost.toFixed(2),
                totalPaid: totalPaid.toFixed(2),
                due: due.toFixed(2),
                date: purchaseSummary[companyName].date,
                phone: usersMap[companyName] || 'N/A',
              };
            }).filter(item => parseFloat(item.due) > 0);

            // Apply date range filter
            const filteredData = filterByDateRange(combinedData, startDate, endDate);
            setPendingCompanies(filteredData);

            // Debug logging
            console.log('Pending Companies:', filteredData);
          },
          (error) => {
            console.error('Error fetching purchases:', error);
            toast.error('Failed to fetch purchase data');
          }
        );
      },
      (error) => {
        console.error('Error fetching ledger entries:', error);
        toast.error('Failed to fetch ledger data');
      }
    );

    return () => {
      if (typeof unsubscribeUsers === 'function') unsubscribeUsers();
      if (typeof unsubscribeLedger === 'function') unsubscribeLedger();
      if (typeof unsubscribePurchases === 'function') unsubscribePurchases();
    };
  }, [startDate, endDate]);

  const filteredCompanies = pendingCompanies.filter((company) =>
    Object.values({
      companyName: company.companyName,
      phone: company.phone,
      totalCost: company.totalCost,
      totalPaid: company.totalPaid,
      due: company.due,
    }).some((val) =>
      String(val).toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredCompanies.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredCompanies.length / itemsPerPage);

  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  return (
    <div className="max-w-8xl mx-auto p-6 bg-gradient-to-b from-gray-50 to-gray-100 min-h-screen">
      <h2 className="text-3xl font-bold mb-6 bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
        Party Pending Dues
      </h2>

      {/* Search and Date Filter */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-6">
        <input
          type="text"
          placeholder="🔍 Search by company, phone, cost, paid, due..."
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
              <th className="py-3 px-6 font-semibold">Party Name</th>
              <th className="py-3 px-6 font-semibold">Phone Number</th>
              <th className="py-3 px-6 font-semibold">Total Cost</th>
              <th className="py-3 px-6 font-semibold">Total Paid</th>
              <th className="py-3 px-6 font-semibold">Pending Dues</th>
              <th className="py-3 px-6 font-semibold">Date</th>
            </tr>
          </thead>
          <tbody>
            {currentItems.length > 0 ? (
              currentItems.map((company) => (
                <tr key={company.id} className="border-b border-gray-200 hover:bg-gray-50 transition duration-200">
                  <td className="py-3 px-6">{company.companyName}</td>
                  <td className="py-3 px-6">{company.phone}</td>
                  <td className="py-3 px-6 text-green-700 font-semibold">
                    Rs. {parseFloat(company.totalCost).toLocaleString()}
                  </td>
                  <td className="py-3 px-6 text-green-700 font-semibold">
                    Rs. {parseFloat(company.totalPaid).toLocaleString()}
                  </td>
                  <td className="py-3 px-6 text-red-600 font-semibold">
                    Rs. {parseFloat(company.due).toLocaleString()}
                  </td>
                  <td className="py-3 px-6">{company.date}</td>
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

      {/* Pagination */}
      <div className="flex justify-center gap-2 mt-4">
        {Array.from({ length: totalPages }, (_, i) => i + 1).map(number => (
          <button
            key={number}
            onClick={() => paginate(number)}
            className={`px-4 py-2 rounded-xl ${currentPage === number ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
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

export default CompanyPendingDues;