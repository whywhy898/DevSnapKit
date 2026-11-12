import { annotationGeometry, type AnnotationObject } from './annotations';

export function AnnotationRenderer({ object, size }: { object: AnnotationObject; size: { width: number; height: number } }) {
  const g = annotationGeometry(object, size), inset = Math.min(g.strokeWidth / 2, g.width / 2, g.height / 2);
  return <svg data-annotation={object.annotation} width="100%" height="100%" viewBox={`0 0 ${g.width} ${g.height}`} style={{ display: 'block', overflow: 'visible' }}>
    {object.annotation === 'arrow' ? <g fill="none" stroke={object.stroke} strokeWidth={g.strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <line x1={g.start.x} y1={g.start.y} x2={g.end.x} y2={g.end.y} />
      <polyline points={`${g.head[0].x},${g.head[0].y} ${g.end.x},${g.end.y} ${g.head[1].x},${g.head[1].y}`} />
    </g> : <rect x={object.annotation === 'highlight' ? 0 : inset} y={object.annotation === 'highlight' ? 0 : inset}
      width={object.annotation === 'highlight' ? g.width : Math.max(0, g.width - inset * 2)} height={object.annotation === 'highlight' ? g.height : Math.max(0, g.height - inset * 2)}
      fill={object.fill} stroke={object.stroke} strokeWidth={g.strokeWidth} />}
  </svg>;
}
