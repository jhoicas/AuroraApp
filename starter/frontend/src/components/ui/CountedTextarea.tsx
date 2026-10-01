import React, { forwardRef, useState, useEffect } from 'react';

export interface CountedTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

export const CountedTextarea = forwardRef<HTMLTextAreaElement, CountedTextareaProps>(
  ({ className, maxLength, value, defaultValue, onChange, ...props }, ref) => {
    const [currentLength, setCurrentLength] = useState(
      () => String(value ?? defaultValue ?? '').length
    );

    useEffect(() => {
      if (value !== undefined) {
        setCurrentLength(String(value).length);
      }
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setCurrentLength(e.target.value.length);
      if (onChange) {
        onChange(e);
      }
    };

    return (
      <div className="w-full">
        <textarea
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
CountedTextarea.displayName = 'CountedTextarea';
