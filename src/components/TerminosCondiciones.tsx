interface Props {
  onClose: () => void
}

export default function TerminosCondiciones({ onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.85)' }}>
      <div
        className="w-full max-w-2xl max-h-[85vh] rounded-2xl overflow-hidden flex flex-col"
        style={{ backgroundColor: '#0D0D0D', border: '1px solid rgba(212,175,55,0.3)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h2 className="text-lg font-bold text-white">Términos y Condiciones</h2>
          <button
            onClick={onClose}
            className="text-white/40 hover:text-white transition-colors text-2xl leading-none"
          >
            &times;
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto px-6 py-5 text-sm text-white/70 leading-relaxed space-y-5">
          <p className="text-white/40 text-xs">Última actualización: 14 de marzo de 2026</p>

          <section>
            <h3 className="text-white font-semibold mb-2">1. Identificación del Responsable</h3>
            <p>
              El presente sistema de gestión <strong className="text-white">Monastery Club</strong> (en adelante "la Plataforma")
              es operado por Monastery Club, establecimiento de comercio ubicado en Baranoa, Atlántico, Colombia.
              NIT: [Por definir]. Correo de contacto: admin@monastery.co.
            </p>
          </section>

          <section>
            <h3 className="text-white font-semibold mb-2">2. Objeto</h3>
            <p>
              Los presentes Términos y Condiciones regulan el acceso y uso de la Plataforma de gestión interna
              de Monastery Club, diseñada exclusivamente para el registro de ventas, cuadre de caja y consulta
              de indicadores del negocio. Este sistema es de uso exclusivo para personal autorizado
              (Administrador y Dueño del establecimiento).
            </p>
          </section>

          <section>
            <h3 className="text-white font-semibold mb-2">3. Aceptación de los Términos</h3>
            <p>
              Al acceder e ingresar sus credenciales en la Plataforma, el usuario declara que ha leído,
              comprendido y aceptado la totalidad de estos Términos y Condiciones, de conformidad con lo
              dispuesto en la <strong className="text-white">Ley 527 de 1999</strong> sobre comercio electrónico
              y mensajes de datos en Colombia.
            </p>
          </section>

          <section>
            <h3 className="text-white font-semibold mb-2">4. Usuarios Autorizados</h3>
            <p>El acceso a la Plataforma está restringido a dos (2) tipos de usuarios:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li><strong className="text-white">Administrador:</strong> Acceso completo al sistema, incluyendo registro de jornadas, gestión de productos, meseros y cuadre de caja.</li>
              <li><strong className="text-white">Dueño:</strong> Acceso exclusivo al dashboard de consulta e indicadores de gestión.</li>
            </ul>
            <p className="mt-2">
              Cada usuario es responsable de la custodia y confidencialidad de sus credenciales de acceso.
              Queda prohibido compartir, ceder o transferir las credenciales a terceros.
            </p>
          </section>

          <section>
            <h3 className="text-white font-semibold mb-2">5. Uso Adecuado de la Plataforma</h3>
            <p>El usuario se compromete a:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Utilizar la Plataforma únicamente para los fines de gestión interna de Monastery Club.</li>
              <li>Ingresar información veraz, completa y actualizada.</li>
              <li>No intentar acceder a funcionalidades o datos fuera de su rol asignado.</li>
              <li>No realizar ingeniería inversa, descompilar o intentar extraer el código fuente.</li>
              <li>Reportar de inmediato cualquier vulnerabilidad o uso no autorizado detectado.</li>
            </ul>
          </section>

          <section>
            <h3 className="text-white font-semibold mb-2">6. Propiedad Intelectual</h3>
            <p>
              La Plataforma, su código fuente, diseño, interfaz gráfica, logos, marcas y demás elementos
              son propiedad exclusiva de Monastery Club y están protegidos por la
              <strong className="text-white"> Ley 23 de 1982</strong> (Derechos de Autor), la
              <strong className="text-white"> Decisión Andina 351 de 1993</strong> y demás normas aplicables
              en materia de propiedad intelectual en Colombia.
            </p>
          </section>

          <section>
            <h3 className="text-white font-semibold mb-2">7. Disponibilidad del Servicio</h3>
            <p>
              Monastery Club se esfuerza por mantener la Plataforma disponible de forma continua.
              Sin embargo, no garantiza la disponibilidad ininterrumpida del servicio y no será responsable
              por interrupciones derivadas de mantenimiento programado, fallas técnicas, problemas de
              conectividad a internet o causas de fuerza mayor conforme al
              <strong className="text-white"> artículo 64 del Código Civil Colombiano</strong>.
            </p>
          </section>

          <section>
            <h3 className="text-white font-semibold mb-2">8. Limitación de Responsabilidad</h3>
            <p>
              La Plataforma es una herramienta de apoyo a la gestión. Monastery Club no será responsable por:
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Errores en el ingreso de datos por parte del usuario.</li>
              <li>Decisiones comerciales basadas en los reportes generados.</li>
              <li>Pérdida de datos ocasionada por el mal uso de la Plataforma.</li>
              <li>Daños indirectos, incidentales o consecuenciales derivados del uso del sistema.</li>
            </ul>
          </section>

          <section>
            <h3 className="text-white font-semibold mb-2">9. Protección de Datos Personales</h3>
            <p>
              El tratamiento de datos personales se rige por la
              <strong className="text-white"> Ley 1581 de 2012</strong> (Ley de Protección de Datos Personales)
              y su <strong className="text-white">Decreto Reglamentario 1377 de 2013</strong>.
              Para mayor información, consulte nuestra Política de Privacidad.
            </p>
          </section>

          <section>
            <h3 className="text-white font-semibold mb-2">10. Modificaciones</h3>
            <p>
              Monastery Club se reserva el derecho de modificar estos Términos y Condiciones en cualquier momento.
              Las modificaciones serán notificadas a los usuarios a través de la Plataforma y entrarán en vigor
              desde su publicación. El uso continuado de la Plataforma después de las modificaciones constituye
              aceptación de los nuevos términos.
            </p>
          </section>

          <section>
            <h3 className="text-white font-semibold mb-2">11. Legislación Aplicable y Jurisdicción</h3>
            <p>
              Los presentes Términos y Condiciones se rigen por las leyes de la República de Colombia.
              Cualquier controversia que surja en relación con el uso de la Plataforma será sometida a
              la jurisdicción de los jueces y tribunales competentes del municipio de Baranoa,
              departamento del Atlántico, Colombia, de conformidad con el
              <strong className="text-white"> Código General del Proceso (Ley 1564 de 2012)</strong>.
            </p>
          </section>

          <section>
            <h3 className="text-white font-semibold mb-2">12. Resolución Alternativa de Conflictos</h3>
            <p>
              Antes de acudir a la vía judicial, las partes se comprometen a intentar resolver cualquier
              diferencia de manera directa y amigable. En caso de no lograrse un acuerdo, podrán acudir
              a los mecanismos alternativos de solución de conflictos previstos en la
              <strong className="text-white"> Ley 640 de 2001</strong>, tales como la conciliación o la mediación.
            </p>
          </section>

          <section>
            <h3 className="text-white font-semibold mb-2">13. Contacto</h3>
            <p>
              Para cualquier consulta, queja o reclamo relacionado con estos Términos y Condiciones,
              el usuario podrá comunicarse a través de:
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Correo electrónico: admin@monastery.co</li>
              <li>Dirección: Monastery Club, Baranoa, Atlántico, Colombia</li>
            </ul>
          </section>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/10">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl text-sm font-bold transition-all duration-200"
            style={{ background: 'linear-gradient(135deg, #D4AF37, #F5D76E)', color: '#0D0D0D' }}
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  )
}
