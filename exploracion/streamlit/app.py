"""Prueba de Streamlit con la misma tabla que las demás herramientas (exploracion/datos/preguntas_por_comuna.csv).

    cd exploracion/streamlit && .venv/bin/streamlit run app.py --server.headless true

Muestra la primera pregunta (hurto a personas por 10.000 habitantes, 2022): ranking, mapa por comuna y la procedencia de la
columna (código de fuente, periodo, fecha de prueba y licencia) leída de fuentes.json.
"""

import json
from pathlib import Path

import pandas as pd
import pydeck as pdk
import streamlit as st

RAIZ = Path(__file__).resolve().parents[2]
datos = pd.read_csv(RAIZ / 'exploracion' / 'datos' / 'preguntas_por_comuna.csv', dtype={'codigo': str})
fuentes = json.loads((RAIZ / 'exploracion' / 'datos' / 'fuentes.json').read_text(encoding='utf-8'))
limites = json.loads((RAIZ / 'public' / 'data' / 'geo' / 'comunas.geojson').read_text(encoding='utf-8'))

st.set_page_config(page_title='Medellín · prueba de Streamlit', layout='wide')
st.title('¿En qué comunas se concentra el hurto a personas?')
columna = st.selectbox('Indicador', [c for c in datos.columns if c not in ('codigo', 'territorio', 'tipo')])
f = fuentes[columna]
st.caption(f"Fuente {f['fuente']} · periodo {f['periodo']} · {f['estado']}{' · PROXY de ' + f['proxy'] if f['proxy'] else ''} · "
           f"probada {f['probada']} · licencia: {f['licencia']}")

izq, der = st.columns(2)
with izq:
    st.bar_chart(datos.set_index('territorio')[columna].sort_values(ascending=False))
with der:
    valores = dict(zip(datos.codigo, datos[columna]))
    maximo = datos[columna].max()
    caract = []
    for ft in limites['features']:
        cod = ft['properties'].get('CODIGO')
        v = valores.get(cod)
        if v is None or pd.isna(v):
            continue
        t = float(v) / float(maximo)
        caract.append({**ft, 'properties': {**ft['properties'], 'valor': float(v), 'color': [int(60 + 190 * t), 80, int(200 - 120 * t), 190]}})
    capa = pdk.Layer('GeoJsonLayer', {'type': 'FeatureCollection', 'features': caract}, get_fill_color='properties.color',
                     get_line_color=[255, 255, 255], pickable=True)
    st.pydeck_chart(pdk.Deck(layers=[capa], initial_view_state=pdk.ViewState(latitude=6.25, longitude=-75.58, zoom=9.5),
                             tooltip={'text': '{NOMBRE}: {valor}'}))
st.dataframe(datos)
