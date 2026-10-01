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


if __name__ == '__main__':
    unittest.main()
