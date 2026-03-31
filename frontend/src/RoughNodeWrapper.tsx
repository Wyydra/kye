import React, { useRef, useEffect, useState } from 'react';
import rough from 'roughjs';

interface RoughNodeWrapperProps {
    children: React.ReactNode;
    width?: number | string;
    height?: number | string;
    color?: string;
    backgroundColor?: string;
    className?: string;
    selected?: boolean;
}

export function RoughNodeWrapper({
    children,
    width = '100%',
    height = '100%',
    color = '#444',
    backgroundColor = '#fff',
    className = '',
    selected = false,
}: RoughNodeWrapperProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const svgRef = useRef<SVGSVGElement>(null);
    const [size, setSize] = useState({ width: 0, height: 0 });

    useEffect(() => {
        if (!containerRef.current) return;

        const updateSize = () => {
            const { clientWidth, clientHeight } = containerRef.current!;
            setSize({ width: clientWidth, height: clientHeight });
        };

        const resizeObserver = new ResizeObserver(updateSize);
        resizeObserver.observe(containerRef.current);
        updateSize();

        return () => resizeObserver.disconnect();
    }, []);

    useEffect(() => {
        if (!svgRef.current || size.width === 0 || size.height === 0) return;

        const rc = rough.svg(svgRef.current);
        svgRef.current.innerHTML = ''; // Efficient clear

        const options = { roughness: 1.2, strokeWidth: 2, stroke: color };

        // Background and Main Border combined if possible, or just simpler
        svgRef.current.appendChild(rc.rectangle(2, 2, size.width - 4, size.height - 4, {
            ...options,
            fill: backgroundColor,
            fillStyle: 'solid',
            stroke: selected ? '#3b82f6' : color,
        }));

        if (selected) {
            svgRef.current.appendChild(rc.rectangle(0, 0, size.width, size.height, {
                roughness: 2,
                stroke: '#3b82f6',
                strokeWidth: 2,
            }));
        }
    }, [size, color, backgroundColor, selected]);

    return (
        <div
            ref={containerRef}
            className={`rough - node - wrapper ${className} `}
            style={{
                position: 'relative',
                width,
                height,
                minWidth: 200,
                minHeight: 100,
            }}
        >
            <svg
                ref={svgRef}
                width={size.width}
                height={size.height}
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    pointerEvents: 'none',
                    zIndex: 0,
                }}
            />
            <div
                style={{
                    position: 'relative',
                    zIndex: 1,
                    padding: '12px',
                    height: '100%',
                    width: '100%',
                    boxSizing: 'border-box',
                    display: 'flex',
                    flexDirection: 'column',
                }}
            >
                {children}
            </div>
        </div>
    );
}
