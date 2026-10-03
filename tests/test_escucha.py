"""Pruebas de las partes puras de la escucha social (sin red): ventanas de meses, filtro de ruido y temas de los titulares.

    .venv/bin/python -m unittest tests.test_escucha -v
"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'ingesta'))

import pull_escucha as pe  # noqa: E402


def articulo(titulo, fecha='20261001T120000Z', url=None, **extra):
    return {'title': titulo, 'seendate': fecha, 'url': url or f'https://medio.co/{abs(hash((titulo, fecha)))}',
            'domain': 'medio.co', 'language': 'Spanish', 'sourcecountry': 'Colombia', **extra}


class Ventanas(unittest.TestCase):
    def test_meses_hacia_atras_cruza_el_anio(self):
        self.assertEqual(pe.meses_hacia_atras('2026-02', 4), ['2025-11', '2025-12', '2026-01', '2026-02'])

    def test_doce_y_doce_anteriores_no_se_solapan(self):
        veinticuatro = pe.meses_hacia_atras('2026-09', 24)
        self.assertEqual(veinticuatro[:12][-1], '2025-09')
        self.assertEqual(veinticuatro[12:][0], '2025-10')

    def test_variacion(self):
        self.assertEqual(pe.variacion(80, 100), -20.0)
        self.assertIsNone(pe.variacion(5, 0))

    def test_etiqueta_mes(self):
        self.assertEqual(pe.etiqueta_mes('2026-09'), 'sep 2026')


class Titulares(unittest.TestCase):
    def test_limpia_la_puntuacion_de_gdelt(self):
        self.assertEqual(pe.limpiar_titular('Medellín : suma 30 . 000  casos ¿ por qué ?'), 'Medellín: suma 30.000 casos ¿por qué?')

    def test_reglas_de_ruido_en_orden(self):
        quedan, sacados = pe.filtrar_titulares([
            articulo('Luck Ra y La Joaqui confirmaron todo'),                       # no nombra a Medellín
            articulo('Medellín, Cebu: typhoon damages houses'),                     # homónimo
            articulo('Capturan a dos hombres en Medellín – Publinews'),
            articulo('Capturan a dos hombres en Medellin', '20261002T080000Z'),    # repetido (sin tilde, sin medio)
            articulo('Resultados Lotería de Medellín: último sorteo del viernes'),  # nombre propio
            articulo('Gasolina sube: así queda el precio en Medellín'),
        ])
        self.assertEqual(sacados, {'sin_mencion': 1, 'homonimo': 1, 'otro_sujeto': 1, 'duplicado': 1})
        self.assertEqual([q['titulo'] for q in quedan],
                         ['Capturan a dos hombres en Medellín – Publinews', 'Gasolina sube: así queda el precio en Medellín'])

    def test_conserva_el_primero_que_vio_gdelt(self):
        quedan, _ = pe.filtrar_titulares([articulo('Lluvias en Medellín', '20261002T000000Z', 'https://b.co'),
                                          articulo('Lluvias en Medellín', '20261001T000000Z', 'https://a.co')])
        self.assertEqual([q['url'] for q in quedan], ['https://a.co'])

    def test_temas_por_comienzo_de_palabra(self):
        self.assertIn('seguridad', pe.temas_de('Bajan los homicidios en Medellín'))
        self.assertIn('ambiente', pe.temas_de('Fuerte aguacero en Medellín'))

    def test_palabra_completa_con_dolar(self):
        self.assertNotIn('deporte', pe.temas_de('Golpe de calor en Medellín'))  # "gol$" no atrapa "golpe"
        self.assertIn('deporte', pe.temas_de('Un gol en el último minuto en Medellín'))
        self.assertNotIn('ambiente', pe.temas_de('Vuelo directo de Medellín a Buenos Aires'))

    def test_sin_tema(self):
        self.assertEqual(pe.temas_de('Preguntas difíciles que tiene Medellín'), [])

    def test_las_claves_de_tema_no_se_repiten(self):
        claves = [t[0] for t in pe.TEMAS_PRENSA]
        self.assertEqual(len(claves), len(set(claves)))


class Territorios(unittest.TestCase):
    def test_un_articulo_por_cada_uno_de_los_21_territorios(self):
        self.assertEqual(len(pe.ARTICULOS_TERRITORIO), 21)
        self.assertEqual(len(set(pe.ARTICULOS_TERRITORIO.values())), 21)


if __name__ == '__main__':
    unittest.main()
