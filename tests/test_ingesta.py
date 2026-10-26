"""Pruebas de las partes puras de la ingesta (sin red): conversión de números, nombres de territorios y contrato del lago.

    .venv/bin/python -m unittest discover -s tests -v
"""

import json
import socket
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'ingesta'))

import correr  # noqa: E402
import lago  # noqa: E402
import verificar  # noqa: E402


class Numeros(unittest.TestCase):
    def test_coma_decimal_y_basura(self):
        self.assertEqual(lago.numero('6,97'), 6.97)
        self.assertEqual(lago.numero(3), 3.0)
        for basura in ('Sin dato', None, ''):
            self.assertIsNone(lago.numero(basura), basura)


class Nombres(unittest.TestCase):
    def test_normaliza_tildes_mayusculas_y_prefijo(self):
        self.assertEqual(lago.normalizar_nombre('Corregimiento de San Cristóbal'), 'SAN CRISTOBAL')
        self.assertEqual(lago.normalizar_nombre('  la   candelaria '), 'LA CANDELARIA')

    def test_repara_tildes_mal_codificadas(self):
        self.assertEqual(lago.normalizar_nombre('BelÃ©n'), 'BELEN')


class TerritoriosDelGemelo(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if not (lago.RAIZ / 'public' / 'data' / 'geo' / 'comunas.geojson').exists():
            raise unittest.SkipTest('falta comunas.geojson (lo genera `correr.py gemelo`)')
        cls.t = lago.Territorios()

    def test_son_21(self):
        self.assertEqual(len(self.t.filas), 21)

    def test_reconoce_nombres_de_las_fuentes(self):
        self.assertEqual(self.t.codigo('Laureles'), '11')  # alias: el límite dice "Laureles Estadio"
        self.assertEqual(self.t.codigo('PALMITAS'), '50')
        self.assertEqual(self.t.codigo('BelÃ©n'), self.t.codigo('Belén'))
        self.assertIsNone(self.t.codigo('Bogotá'))

    def test_valor_ignora_nulos_y_rechaza_codigos_desconocidos(self):
        codigo = next(iter(self.t.filas))
        self.t.valor(codigo, 'x', 2026, None)
        self.assertNotIn('x', self.t.filas[codigo]['valores'])
        self.t.valor(int(codigo), 'x', 2026, 5)
        self.assertEqual(self.t.filas[codigo]['valores']['x'], {'2026': 5})
        with self.assertRaises(RuntimeError):
            self.t.valor('99', 'x', 2026, 1)


class Ipv4Primero(unittest.TestCase):
    def test_ordena_las_ipv4_antes_que_las_ipv6(self):
        falso = lambda *a, **k: [(socket.AF_INET6, 1, 6, '', ('::1', 80)), (socket.AF_INET, 1, 6, '', ('127.0.0.1', 80))]  # noqa: E731
        familias = [d[0] for d in lago._ipv4_primero(falso)('x', 80)]
        self.assertEqual(familias, [socket.AF_INET, socket.AF_INET6])


def tema_valido(**cambios):
    tema = {
        'tema': 'prueba', 'titulo': 'Prueba', 'probado': lago.hoy().isoformat(), 'ancla': ['a'],
        'fuentes': [{'id': 'f1', 'nombre': 'Fuente', 'entidad': 'Ente', 'url': 'https://ejemplo.co', 'estado': 'observado',
                     'probado': lago.hoy().isoformat()}],
        'cifras': {'a': {'valor': 1, 'unidad': 'u', 'etiqueta': 'A', 'fuente': 'f1', 'vigencia': '2026', 'estado': 'observado'}},
        'series': {}, 'listas': {}
    }
    tema.update(cambios)
    return tema


class Contrato(unittest.TestCase):
    def errores(self, tema):
        with tempfile.TemporaryDirectory() as d:
            ruta = Path(d) / 'prueba.json'
            ruta.write_text(json.dumps(tema), encoding='utf-8')
            inf = verificar.Informe()
            verificar.verificar_tema(ruta, inf)
            return inf.errores

    def test_un_tema_valido_pasa(self):
        self.assertEqual(self.errores(tema_valido()), [])

    def test_cifra_sin_fuente_declarada_falla(self):
        tema = tema_valido()
        tema['cifras']['a']['fuente'] = 'otra'
        self.assertTrue(self.errores(tema))

    def test_estado_desconocido_falla(self):
        tema = tema_valido()
        tema['cifras']['a']['estado'] = 'inventado'
        self.assertTrue(self.errores(tema))

    def test_valor_no_finito_falla(self):
        tema = tema_valido()
        tema['cifras']['a']['valor'] = float('nan')
        self.assertTrue(self.errores(tema))

    def test_cifra_de_texto_sin_unidad_es_valida(self):
        tema = tema_valido()
        tema['cifras']['a'].update(valor='Acuerdo 48 de 2014', unidad='')
        self.assertEqual(self.errores(tema), [])

    def test_candidato_sin_valor_es_valido(self):
        tema = tema_valido()
        tema['cifras']['a'].update(valor=None, estado='candidato')
        self.assertEqual(self.errores(tema), [])

    def test_ancla_inexistente_falla(self):
        self.assertTrue(self.errores(tema_valido(ancla=['no-existe'])))



class VigenciaDelCatalogo(unittest.TestCase):
    def test_las_series_mandan_luego_las_cifras(self):
        tema = tema_valido(series={'s': {'fuente': 'f1', 'vigencia': '2015 – 2026'}})
        self.assertEqual(correr.vigencia_de(tema, 'f1'), '2015 – 2026')
        self.assertEqual(correr.vigencia_de(tema_valido(), 'f1'), '2026')

    def test_una_fuente_con_solo_indicadores_toma_su_vigencia(self):
        tema = tema_valido(cifras={}, listas={'indicadores': [{'fuente': 'f1', 'vigencia': '2014–2024'},
                                                              {'fuente': 'f1', 'vigencia': '2014–2021'},
                                                              {'fuente': 'otra', 'vigencia': '1990'}]})
        self.assertEqual(correr.vigencia_de(tema, 'f1'), '2014–2021 · 2014–2024')

    def test_una_capa_sin_datos_no_tiene_vigencia(self):
        self.assertEqual(correr.vigencia_de(tema_valido(cifras={}), 'f1'), '')


class FichasDelCatalogo(unittest.TestCase):
    def verificar(self, datasets):
        inf = verificar.Informe()
        verificar.verificar_fichas({'datasets': datasets}, inf)
        return inf

    def ficha(self, **cambios):
        base = {'id': 'x', 'codigo': 'F001', 'licencia': 'CC BY 4.0', 'licencia_url': 'https://a.co', 'licencia_probada': '2026-10-24',
                'personas': 'No: la fuente no trae datos de personas.', 'proteccion': 'Abierto'}
        return {**base, **cambios}

    def test_una_ficha_completa_pasa(self):
        self.assertEqual(self.verificar([self.ficha()]).errores, [])

    def test_sin_licencia_o_sin_codigo_falla(self):
        self.assertTrue(self.verificar([self.ficha(licencia='')]).errores)
        self.assertTrue(self.verificar([self.ficha(codigo='1')]).errores)

    def test_codigo_repetido_falla(self):
        self.assertTrue(self.verificar([self.ficha(), self.ficha(id='y')]).errores)

    def test_licencia_sin_verificar_es_aviso_no_error(self):
        inf = self.verificar([self.ficha(licencia='Sin verificar: la fuente no respondió')])
        self.assertEqual(inf.errores, [])
        self.assertTrue(inf.avisos)

    def test_datos_de_personas_no_pueden_quedar_abiertos_a_secas(self):
        self.assertTrue(self.verificar([self.ficha(personas='Sí: sexo y edad de la víctima.', proteccion='Abierto')]).errores)
        self.assertEqual(self.verificar([self.ficha(personas='Sí: sexo y edad de la víctima.', proteccion='Abierto, solo agregados: conteos')]).errores, [])


class CamposDePersona(unittest.TestCase):
    def test_encuentra_un_campo_de_persona_en_listas_y_propiedades(self):
        self.assertEqual(list(verificar.campos_de_persona({'listas': {'x': [{'sexo': 'M', 'casos': 1}]}})), ['/listas/x[0]/sexo'])
        self.assertEqual(list(verificar.campos_de_persona({'features': [{'properties': {'edad': 30}}]})), ['/features[0]/properties/edad'])

    def test_una_metrica_llamada_ocupacion_no_es_un_campo(self):
        self.assertEqual(list(verificar.campos_de_persona({'cifras': {'ocupacion': {'valor': 60}}})), [])

    def test_lo_publicado_no_trae_campos_de_persona(self):
        inf = verificar.Informe()
        verificar.verificar_personas(inf)
        self.assertEqual(inf.errores, [])


class SiniestrosAgregados(unittest.TestCase):
    def test_el_punto_va_al_centro_de_su_celda(self):
        import pull_lentes
        self.assertEqual(pull_lentes.centro_de_celda(-75.5593), -75.5595)
        self.assertEqual(pull_lentes.centro_de_celda(6.26691), 6.2665)


if __name__ == '__main__':
    unittest.main()
