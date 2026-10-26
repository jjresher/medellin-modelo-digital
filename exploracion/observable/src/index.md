# ¿En qué comunas se concentra el hurto a personas?

```js
const datos = await FileAttachment('data/preguntas.csv').csv({ typed: false });
const fuentes = await FileAttachment('data/fuentes.json').json();
const comunas = await FileAttachment('data/comunas.json').json();
const columna = view(Inputs.select(Object.keys(fuentes), { label: 'Indicador' }));
```

```js
const f = fuentes[columna];
display(html`<p><small>Fuente <b>${f.fuente}</b> · periodo ${f.periodo} · ${f.estado}${f.proxy ? ' · PROXY de ' + f.proxy : ''} · probada ${f.probada} · licencia: ${f.licencia}</small></p>`);
const filas = datos.filter((d) => d[columna] !== '').map((d) => ({ ...d, valor: +d[columna] }));
const porCodigo = new Map(filas.map((d) => [d.codigo, d.valor]));
```

<div class="grid grid-cols-2">
<div class="card">

```js
display(Plot.plot({ marginLeft: 130, x: { label: null }, y: { label: null },
  marks: [Plot.barX(filas, { x: 'valor', y: 'territorio', fill: '#f92672', tip: true, sort: { y: 'x', reverse: true } })] }));
```

</div>
<div class="card">

```js
const validas = { type: 'FeatureCollection', features: comunas.features.filter((x) => x.properties.NOMBRE) };
display(Plot.plot({ projection: { type: 'reflect-y', domain: validas }, color: { scheme: 'purd', legend: true },
  marks: [Plot.geo(validas, { fill: (x) => porCodigo.get(x.properties.CODIGO), stroke: '#fff', tip: true, title: (x) => `${x.properties.NOMBRE}: ${porCodigo.get(x.properties.CODIGO) ?? 'sin dato'}` })] }));
```

</div>
</div>
