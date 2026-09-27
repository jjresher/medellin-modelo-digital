"""Turismo: extranjeros no residentes (MinCIT) y pasajeros del aeropuerto José María Córdova (Aerocivil)."""

from lago import MESES, Tema, socrata

MINCIT = '7wm8-w5ad'
AEROCIVIL = 'gb6w-ynu4'
AEROPUERTO = "(origen='MDE' or destino='MDE')"


def anuales(filas, clave_anio, clave_valor):
    return {int(f[clave_anio]): int(float(f[clave_valor])) for f in filas}


def extranjeros(t):
    fuente = t.fuente('mincit-extranjeros', 'Extranjeros no residentes por ciudad de destino',
                      'Ministerio de Comercio, Industria y Turismo', f'https://www.datos.gov.co/d/{MINCIT}')
    donde = "ciudad='Medellín'"
    filas = socrata(MINCIT, select='a_o, sum(cant_extranjeros_no_residentes) as n, count(distinct mes) as meses',
                    where=donde, group='a_o', order='a_o')
    por_anio = anuales(filas, 'a_o', 'n')
    meses = {int(f['a_o']): int(f['meses']) for f in filas}
    completo = max(a for a, m in meses.items() if m == 12)
    t.cifra('visitantes_extranjeros', por_anio[completo], 'personas', f'Visitantes extranjeros {completo}', fuente,
            str(completo), ancla=True, nota='Extranjeros no residentes que declararon Medellín como destino.')
    t.serie('visitantes_extranjeros_anual', [[str(a), n] for a, n in sorted(por_anio.items())], 'personas',
            'Visitantes extranjeros por año', fuente,
            nota=f'{max(por_anio)} parcial.' if max(por_anio) > completo else '')

    actual = max(por_anio)
    if actual > completo:
        presentes = {f['mes'].lower()[:3] for f in socrata(MINCIT, select='distinct mes',
                                                            where=f"{donde} and a_o='{actual}'")}
        ultimo = max(MESES.index(m) for m in presentes if m in MESES)
        lista_meses = ', '.join(f"'{MESES[i].capitalize()}'" for i in range(ultimo + 1))
        previo = socrata(MINCIT, select='sum(cant_extranjeros_no_residentes) as n',
                         where=f"{donde} and a_o='{actual - 1}' and mes in ({lista_meses})")[0]['n']
        vigencia = f'ene–{MESES[ultimo]} {actual}'
        t.cifra('visitantes_extranjeros_anio_curso', por_anio[actual], 'personas', f'Visitantes extranjeros {actual}',
                fuente, vigencia)
        t.cifra('visitantes_extranjeros_variacion', round((por_anio[actual] / int(float(previo)) - 1) * 100, 1), '%',
                f'Visitantes extranjeros: variación frente a {actual - 1}', fuente, vigencia, estado='derivado',
                decimales=1, nota='Mismos meses del año anterior.')

    paises = socrata(MINCIT, select='paisoeeresidencia as pais, sum(cant_extranjeros_no_residentes) as n',
                     where=f"{donde} and a_o='{completo}'", group='pais', order='n desc', limit=15)
    t.lista('paises_origen', [{'nombre': p['pais'], 'valor': int(float(p['n']))} for p in paises])


def aeropuerto(t):
    fuente = t.fuente('aerocivil-origen-destino', 'Transporte aéreo comercial · tráfico origen–destino',
                      'Aeronáutica Civil de Colombia', f'https://www.datos.gov.co/d/{AEROCIVIL}')
    filas = socrata(AEROCIVIL, select='a_o, sum(pasajeros) as p, max(n_mero_de_mes) as ultimo_mes',
                    where=AEROPUERTO, group='a_o', order='a_o')
    por_anio = anuales(filas, 'a_o', 'p')
    ultimo_mes = {int(f['a_o']): int(f['ultimo_mes']) for f in filas}
    completo = max(a for a, m in ultimo_mes.items() if m == 12)
    nota = 'Pasajeros en vuelos con origen o destino en el aeropuerto José María Córdova (Rionegro).'
    t.cifra('pasajeros_aeropuerto', por_anio[completo], 'pasajeros', f'Pasajeros aeropuerto JMC {completo}', fuente,
            str(completo), ancla=True, nota=nota)
    t.serie('pasajeros_aeropuerto_anual', [[str(a), n] for a, n in sorted(por_anio.items())], 'pasajeros',
            'Pasajeros del aeropuerto por año', fuente, nota=nota)
    actual = max(por_anio)
    if actual > completo:
        t.cifra('pasajeros_aeropuerto_anio_curso', por_anio[actual], 'pasajeros', f'Pasajeros aeropuerto JMC {actual}',
                fuente, f'ene–{MESES[ultimo_mes[actual] - 1]} {actual}', nota=nota)


def main():
    t = Tema('turismo', 'Turismo')
    with t.bloque('mincit-extranjeros'):
        extranjeros(t)
    with t.bloque('aerocivil-origen-destino'):
        aeropuerto(t)
    t.escribir()
    return t


if __name__ == '__main__':
    main()
