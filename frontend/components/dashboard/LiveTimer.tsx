import React, { useEffect, useState } from 'react';

export default function LiveTimer({ startTime }: { startTime: number }) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));
    const interval = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  return <span className="tabular-nums">{elapsedSeconds}s</span>;
}
