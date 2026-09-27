"""Seguridad: delitos de la Policía Nacional (datos.gov.co, MinDefensa) para Medellín, 2018 al último mes publicado.

Solo usa la serie de la Policía; el histórico georreferenciado del SISC (MEData, hasta 2023) entra en la issue #3
como capa de mapa, sin mezclarse con estas series.
"""

import datetime as dt
import json

from lago import DIR_LAGO, MESES, Tema, socrata

MUNICIPIO = "cod_muni='05001'"
DESDE = 2018
DELITOS = [
    # (clave, recurso Socrata, nombre)
    ('homicidios', 'm8fd-ahd9', 'Homicidios'),
    ('hurto_personas', '4rxi-8m8d', 'Hurto a personas'),
    ('hurto_vehiculos', 'csb4-y6v2', 'Hurto de vehículos'),
    ('extorsion', 'q2ib-t9am', 'Extorsión'),
    ('violencia_intrafamiliar', 'gepp-dxcs', 'Violencia intrafamiliar'),
    ('delitos_sexuales', 'bz43-8ahq', 'Delitos sexuales'),
    ('lesiones_personales', 'jr6v-i33g', 'Lesiones personales'),
]


def fecha_corte(recurso):
    fila = socrata(recurso, select='max(fecha_hecho) as corte', where=MUNICIPIO)[0]
    return dt.date.fromisoformat(fila['corte'][:10])


def suma(recurso, desde, hasta):
    fila = socrata(recurso, select='sum(cantidad) as n',
                   where=f"{MUNICIPIO} and fecha_hecho between '{desde}T00:00:00' and '{hasta}T23:59:59'")[0]
    return int(float(fila.get('n') or 0))


def poblacion_por_anio():
    ruta = DIR_LAGO / 'demografia.json'
    if not ruta.exists():
        return {}
    serie = json.loads(ruta.read_text(encoding='utf-8'))['series'].get('poblacion_total', {})
    return {int(a): v for a, v in serie.get('puntos', [])}


def periodo(desde, hasta):
    if desde.month == 1 and desde.day == 1 and hasta.month == 12 and hasta.day == 31:
        return str(desde.year)
    return f'{MESES[desde.month - 1]}–{MESES[hasta.month - 1]} {hasta.year}'


def main():
    t = Tema('seguridad', 'Seguridad')
    poblacion = poblacion_por_anio()

    for clave, recurso, nombre in DELITOS:
        fuente = f'policia-{clave}'.replace('_', '-')
        with t.bloque(fuente):
            t.fuente(fuente, f'{nombre} · Policía Nacional', 'Ministerio de Defensa Nacional · Policía Nacional',
                     f'https://www.datos.gov.co/d/{recurso}')
            corte = fecha_corte(recurso)
            filas = socrata(recurso, select='date_extract_y(fecha_hecho) as anio, sum(cantidad) as n',
                            where=f"{MUNICIPIO} and fecha_hecho >= '{DESDE}-01-01T00:00:00'",
                            group='anio', order='anio')
            anual = {int(f['anio']): int(float(f['n'])) for f in filas}
            completo = corte.year - 1 if corte < dt.date(corte.year, 12, 31) else corte.year

            t.serie(f'{clave}_anual', [[str(a), n] for a, n in sorted(anual.items())], 'casos',
                    f'{nombre} por año', fuente,
                    nota=f'{corte.year} parcial: hasta el {corte.isoformat()}.' if completo < corte.year else '')
            t.cifra(clave, anual[completo], 'casos', f'{nombre} {completo}', fuente, str(completo))

            # Año en curso frente al mismo periodo del año anterior, con el mismo día de corte.
            inicio = dt.date(corte.year, 1, 1)
            actual = suma(recurso, inicio, corte)
            anterior = suma(recurso, inicio.replace(year=corte.year - 1), corte.replace(year=corte.year - 1))
            t.cifra(f'{clave}_anio_curso', actual, 'casos', f'{nombre} en {corte.year}', fuente,
                    periodo(inicio, corte), ancla=clave == 'homicidios',
                    nota=f'Del 1 de enero al {corte.isoformat()}, último día publicado.')
            if anterior:
                t.cifra(f'{clave}_variacion', round((actual - anterior) / anterior * 100, 1), '%',
                        f'{nombre}: variación frente a {corte.year - 1}', fuente, periodo(inicio, corte),
                        estado='derivado', decimales=1,
                        nota=f'{actual} casos frente a {anterior} en el mismo periodo de {corte.year - 1}.')

            if clave == 'homicidios' and completo in poblacion:
                t.cifra('tasa_homicidios', round(anual[completo] / poblacion[completo] * 1e5, 2),
                        'por 100 mil hab.', f'Tasa de homicidios {completo}', fuente, str(completo),
                        estado='derivado', decimales=2, ancla=True,
                        nota=f'{anual[completo]} homicidios (Policía) ÷ {poblacion[completo]:,} habitantes '
                             f'(proyección DANE) × 100.000.'.replace(',', '.'))
                meses = socrata(recurso, select="date_trunc_ym(fecha_hecho) as mes, sum(cantidad) as n",
                                where=f"{MUNICIPIO} and fecha_hecho >= '{corte.year - 2}-01-01T00:00:00'",
                                group='mes', order='mes')
                t.serie('homicidios_mensual', [[m['mes'][:7], int(float(m['n']))] for m in meses], 'casos',
                        'Homicidios por mes', fuente)

    t.escribir()
    return t


if __name__ == '__main__':
    main()
