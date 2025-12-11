import React, { createContext, useContext, useState, ReactNode } from 'react';
import { DateRange } from 'react-day-picker';

interface DateRangeContextType {
  globalDateRange: DateRange | undefined;
  setGlobalDateRange: (range: DateRange | undefined) => void;
}

const DateRangeContext = createContext<DateRangeContextType | undefined>(undefined);

export const DateRangeProvider = ({ children }: { children: ReactNode }) => {
  const [globalDateRange, setGlobalDateRange] = useState<DateRange | undefined>(undefined);

  return (
    <DateRangeContext.Provider value={{ globalDateRange, setGlobalDateRange }}>
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
