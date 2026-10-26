// El estado de una cifra, serie o indicador (observado, declarado, derivado, candidato) y, si el dato es una aproximación de
// otra cosa que no se puede medir directo, el rótulo PROXY con aquello de lo que es proxy.
export default function Estado({ item }) {
  return (
    <>
      <span className={`estado ${item.estado}`}>{item.estado}</span>
      {item.proxy && (
        <>
          {' '}
          <span className="estado proxy" title={`PROXY: aproxima ${item.proxy}`}>
            PROXY
          </span>
        </>
      )}
    </>
  );
}
