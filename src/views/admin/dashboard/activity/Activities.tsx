import { Users, BarChart3, Building2, Activity } from "lucide-react";
import { motion } from "framer-motion";
import { Link } from 'react-router-dom';

  const recentActivities = [
    { text: "Dr. Santos was assigned to Math 101", icon: Users, time: "2m ago" },
    { text: "Room 204 schedule updated", icon: Building2, time: "1h ago" },
    { text: "New course 'Physics 2' added", icon: BarChart3, time: "3h ago" },
  ];

  function Activities() {
    return (
      <>
        {/* Recent Activity Card */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-white rounded-2xl shadow-lg p-6 border-b-4 border-gray-500 relative overflow-hidden"
        >
          <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-slate-100 blur-2xl" aria-hidden />
          <h2 className="text-lg font-bold mb-4 text-gray-800 flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-gray-100 text-gray-600 border border-gray-200">
              <Activity size={18} />
            </span>
            Recent Activity
          </h2>
          <ul className="space-y-4">
            {recentActivities.slice(0,2).map((activity, index) => (
              <li
                key={index}
                className="flex items-start gap-3 text-sm"
              >
                <div className="p-2 bg-gray-100 rounded-xl border border-gray-200 mt-0.5">
                  <activity.icon className="text-gray-600" size={16} />
                </div>
                <div>
                  <p className="text-gray-800">{activity.text}</p>
                  <p className="text-xs text-gray-400">{activity.time}</p>
                </div>
              </li>
            ))}
          </ul>
          {recentActivities.length > 2 && (
            <div className="text-right mt-3">
              <Link to="/admin/activities" className="text-sm font-semibold text-indigo-600 hover:underline">See more</Link>
            </div>
          )}
        </motion.div>

        

        
      </>
    );
  }


  export default Activities;