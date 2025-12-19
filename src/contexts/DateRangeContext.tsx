import React, { createContext, useContext, useState, ReactNode } from 'react';
import { DateRange } from 'react-day-picker';
import { CalendarViewMode } from '@/types';

interface DateRangeContextType {
  globalDateRange: DateRange | undefined;
  setGlobalDateRange: (range: DateRange | undefined) => void;
  globalViewMode: CalendarViewMode;
  setGlobalViewMode: (mode: CalendarViewMode) => void;
  globalSelectedDate: Date;
  setGlobalSelectedDate: (date: Date) => void;
}

const DateRangeContext = createContext<DateRangeContextType | undefined>(undefined);

export const DateRangeProvider = ({ children }: { children: ReactNode }) => {
  const [globalDateRange, setGlobalDateRange] = useState<DateRange | undefined>(undefined);
  const [globalViewMode, setGlobalViewMode] = useState<CalendarViewMode>("week");
  const [globalSelectedDate, setGlobalSelectedDate] = useState<Date>(new Date());

  return (
    <DateRangeContext.Provider value={{ 
      globalDateRange, 
      setGlobalDateRange,
      globalViewMode,
      setGlobalViewMode,
      globalSelectedDate,
      setGlobalSelectedDate
    }}>
      {children}
    </DateRangeContext.Provider>
  );
};

export const useDateRange = () => {
  const context = useContext(DateRangeContext);
  if (!context) {
    throw new Error('useDateRange must be used within a DateRangeProvider');
  }
  return context;
};
