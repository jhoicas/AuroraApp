import React, { forwardRef, useState, useEffect } from 'react';

export interface CountedInputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const CountedInput = forwardRef<HTMLInputElement, CountedInputProps>(
  ({ className, maxLength, value, defaultValue, onChange, ...props }, ref) => {
    const [currentLength, setCurrentLength] = useState(
      () => String(value ?? defaultValue ?? '').length
    );

    useEffect(() => {
      if (value !== undefined) {
        setCurrentLength(String(value).length);
      }
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setCurrentLength(e.target.value.length);
      if (onChange) {
        onChange(e);
      }
    };

    return (
      <div className="w-full">
        <input
          ref={ref}
          value={value}
          defaultValue={defaultValue}
          onChange={handleChange}
          maxLength={maxLength}
          className={className}
          {...props}
        />
        {maxLength !== undefined && (
          <div className="text-xs text-gray-400 mt-1 text-right flex justify-end">
            {currentLength}/{maxLength}
          </div>
        )}
      </div>
    );
  }
);
CountedInput.displayName = 'CountedInput';
