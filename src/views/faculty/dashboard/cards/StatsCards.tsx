import { BookUp, Clock, BookCopy } from "lucide-react";
import { motion } from "framer-motion";

interface StatsCardsProps {
  todaysClasses: number;
  totalSubjects: number;
  totalPreparations: number;
}

function StatsCards({ todaysClasses, totalSubjects, totalPreparations }: StatsCardsProps) {
  const stats = [
    {
      title: "Today's Classes",
      value: String(todaysClasses),
      icon: Clock,
      colors: {
        bg: 'bg-sky-50',
        gradient: 'from-sky-100 to-sky-200',
        text: 'text-sky-600',
        border: 'border-sky-500'
      }
    },
    {
      title: "Total Subjects",
      value: String(totalSubjects),
      icon: BookUp,
      colors: {
        bg: 'bg-amber-50',
        gradient: 'from-amber-100 to-amber-200',
        text: 'text-amber-600',
        border: 'border-amber-500'
      }
    },
    {
      title: "Total Preparations",
      value: String(totalPreparations),
      icon: BookCopy,
      colors: {
        bg: 'bg-rose-50',
        gradient: 'from-rose-100 to-rose-200',
        text: 'text-rose-600',
        border: 'border-rose-500'
      }
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {stats.map((stat, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 + index * 0.1, duration: 0.4, ease: "easeOut" }}
        >
          {/* FIX 2: Gi-ayo ang card design */}
          <div className={`group relative bg-card p-5 rounded-xl border-l-4 ${stat.colors.border} shadow-sm flex items-center gap-5 transition-all duration-300 hover:shadow-md hover:-translate-y-1`}>
            {/* Icon with gradient and hover glow */}
            <div className={`relative flex-shrink-0 p-4 rounded-lg bg-gradient-to-br ${stat.colors.gradient}`}>
              <stat.icon className={`${stat.colors.text}`} size={32} />
              <div className={`absolute -inset-2 rounded-lg ${stat.colors.bg} opacity-0 group-hover:opacity-100 group-hover:scale-110 transition-all duration-300 -z-10 blur-md`}></div>
            </div>
            
            <div className="flex-1">
              <p className="text-3xl font-bold text-foreground">{stat.value}</p>
              <p className="text-sm font-semibold text-muted-foreground">{stat.title}</p>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

export default StatsCards;
