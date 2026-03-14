interface Props {
  onClose: () => void
}

export default function PoliticaPrivacidad({ onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.85)' }}>
      <div
        className="w-full max-w-2xl max-h-[85vh] rounded-2xl overflow-hidden flex flex-col"
        style={{ backgroundColor: '#0D0D0D', border: '1px solid rgba(212,175,55,0.3)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h2 className="text-lg font-bold text-white">Política de Privacidad</h2>
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
            <h3 className="text-white font-semibold mb-2">1. Responsable del Tratamiento</h3>
            <p>
              <strong className="text-white">Monastery Club</strong>, establecimiento de comercio ubicado en
              Baranoa, Atlántico, Colombia, en calidad de Responsable del Tratamiento de datos personales,
              de conformidad con la <strong className="text-white">Ley 1581 de 2012</strong> y el
              <strong className="text-white"> Decreto 1377 de 2013</strong>, presenta la siguiente Política
              de Privacidad y Tratamiento de Datos Personales.
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Razón social: Monastery Club</li>
              <li>NIT: [Por definir]</li>
              <li>Domicilio: Baranoa, Atlántico, Colombia</li>
              <li>Correo: admin@monastery.co</li>
            </ul>
          </section>

          <section>
            <h3 className="text-white font-semibold mb-2">2. Marco Legal</h3>
            <p>Esta política se fundamenta en la normatividad colombiana vigente:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li><strong className="text-white">Artículo 15 de la Constitución Política de Colombia</strong> — Derecho a la intimidad y al habeas data.</li>
              <li><strong className="text-white">Ley Estatutaria 1581 de 2012</strong> — Régimen General de Protección de Datos Personales.</li>
              <li><strong className="text-white">Decreto 1377 de 2013</strong> — Reglamentario parcial de la Ley 1581 de 2012.</li>
              <li><strong className="text-white">Decreto 1074 de 2015</strong> (Título 26) — Decreto Único Reglamentario del sector Comercio, Industria y Turismo.</li>
              <li><strong className="text-white">Ley 1266 de 2008</strong> — Habeas Data financiero y manejo de información en bases de datos.</li>
              <li><strong className="text-white">Circular Externa 002 de 2015</strong> de la Superintendencia de Industria y Comercio (SIC).</li>
            </ul>
          </section>

          <section>
            <h3 className="text-white font-semibold mb-2">3. Definiciones</h3>
            <p>De acuerdo con la Ley 1581 de 2012:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li><strong className="text-white">Dato personal:</strong> Cualquier información vinculada o que pueda asociarse a una persona natural determinada o determinable.</li>
              <li><strong className="text-white">Titular:</strong> Persona natural cuyos datos personales sean objeto de tratamiento.</li>
              <li><strong className="text-white">Tratamiento:</strong> Cualquier operación sobre datos personales, como recolección, almacenamiento, uso, circulación o supresión.</li>
              <li><strong className="text-white">Responsable del tratamiento:</strong> Persona natural o jurídica que decide sobre la base de datos y/o el tratamiento de los datos.</li>
              <li><strong className="text-white">Encargado del tratamiento:</strong> Persona natural o jurídica que realiza el tratamiento de datos por cuenta del responsable.</li>
              <li><strong className="text-white">Autorización:</strong> Consentimiento previo, expreso e informado del titular para llevar a cabo el tratamiento.</li>
            </ul>
          </section>

          <section>
            <h3 className="text-white font-semibold mb-2">4. Datos que Recopilamos</h3>
            <p>La Plataforma recopila y trata los siguientes datos personales de los usuarios autorizados:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li><strong className="text-white">Datos de identificación:</strong> Nombre de usuario, nombre completo.</li>
              <li><strong className="text-white">Datos de autenticación:</strong> Contraseña (almacenada de forma cifrada mediante bcrypt).</li>
              <li><strong className="text-white">Datos de acceso:</strong> Dirección IP, fecha y hora de inicio de sesión, tipo de dispositivo.</li>
              <li><strong className="text-white">Datos operativos:</strong> Registros de jornadas, ventas, cuadres de caja ingresados por el usuario.</li>
            </ul>
            <p className="mt-2">
              Monastery Club <strong className="text-white">NO</strong> recopila datos sensibles conforme
              al artículo 5 de la Ley 1581 de 2012 (origen racial, orientación política, convicciones
              religiosas, datos biométricos, datos de salud, entre otros).
            </p>
          </section>

          <section>
            <h3 className="text-white font-semibold mb-2">5. Finalidad del Tratamiento</h3>
            <p>Los datos personales serán tratados para las siguientes finalidades:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Autenticación y control de acceso a la Plataforma.</li>
              <li>Gestión y registro de las operaciones comerciales del establecimiento.</li>
              <li>Generación de reportes e indicadores de gestión para el dueño del negocio.</li>
              <li>Auditoría interna y trazabilidad de operaciones.</li>
              <li>Cumplimiento de obligaciones legales, contables y tributarias conforme a la normatividad colombiana.</li>
              <li>Seguridad de la información y prevención de accesos no autorizados.</li>
            </ul>
          </section>

          <section>
            <h3 className="text-white font-semibold mb-2">6. Autorización y Consentimiento</h3>
            <p>
              De conformidad con el artículo 9 de la Ley 1581 de 2012, al ingresar sus credenciales
              en la Plataforma, el usuario otorga su autorización previa, expresa e informada para el
              tratamiento de sus datos personales conforme a las finalidades descritas en esta política.
            </p>
            <p className="mt-2">
              La autorización podrá ser revocada en cualquier momento por el titular, mediante solicitud
              dirigida al correo admin@monastery.co, salvo que exista un deber legal o contractual que
              impida la supresión de los datos.
            </p>
          </section>

          <section>
            <h3 className="text-white font-semibold mb-2">7. Derechos del Titular (Artículo 8, Ley 1581 de 2012)</h3>
            <p>Como titular de datos personales, usted tiene derecho a:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li><strong className="text-white">Conocer:</strong> Acceder a sus datos personales que hayan sido objeto de tratamiento.</li>
              <li><strong className="text-white">Actualizar:</strong> Solicitar la actualización de sus datos cuando estén incompletos o inexactos.</li>
              <li><strong className="text-white">Rectificar:</strong> Solicitar la corrección de la información que sea imprecisa.</li>
              <li><strong className="text-white">Suprimir:</strong> Solicitar la eliminación de sus datos cuando no exista obligación legal de conservarlos.</li>
              <li><strong className="text-white">Revocar:</strong> Revocar la autorización otorgada para el tratamiento de datos.</li>
              <li><strong className="text-white">Presentar quejas:</strong> Presentar quejas ante la Superintendencia de Industria y Comercio (SIC) por infracciones a la ley.</li>
            </ul>
          </section>

          <section>
            <h3 className="text-white font-semibold mb-2">8. Procedimiento para Ejercer sus Derechos</h3>
            <p>
              El titular podrá ejercer sus derechos enviando una solicitud al correo
              <strong className="text-white"> admin@monastery.co</strong>, indicando:
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Nombre completo y documento de identificación.</li>
              <li>Descripción de los hechos que dan lugar a la solicitud.</li>
              <li>Derecho que desea ejercer.</li>
              <li>Dirección de notificación.</li>
            </ul>
            <p className="mt-2">
              De conformidad con el artículo 15 de la Ley 1581 de 2012, las consultas serán atendidas
              en un plazo máximo de <strong className="text-white">diez (10) días hábiles</strong>.
              Los reclamos serán atendidos en un plazo máximo de <strong className="text-white">quince (15) días hábiles</strong>,
              prorrogables por ocho (8) días hábiles adicionales.
            </p>
          </section>

          <section>
            <h3 className="text-white font-semibold mb-2">9. Medidas de Seguridad</h3>
            <p>
              Monastery Club implementa medidas técnicas, humanas y administrativas para proteger
              los datos personales, conforme al artículo 4 literal (g) de la Ley 1581 de 2012:
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Contraseñas cifradas con algoritmo bcrypt.</li>
              <li>Autenticación mediante tokens JWT con expiración.</li>
              <li>Comunicaciones cifradas mediante HTTPS/TLS.</li>
              <li>Control de acceso basado en roles (RBAC).</li>
              <li>Almacenamiento en servicios cloud con certificaciones de seguridad (Firebase/Google Cloud).</li>
            </ul>
          </section>

          <section>
            <h3 className="text-white font-semibold mb-2">10. Transferencia y Transmisión de Datos</h3>
            <p>
              Los datos personales podrán ser transmitidos a los siguientes encargados del tratamiento,
              quienes cuentan con políticas de protección de datos adecuadas:
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li><strong className="text-white">Google LLC (Firebase):</strong> Almacenamiento y procesamiento de datos en la nube. Google cuenta con cláusulas contractuales estándar y cumple con estándares internacionales de protección de datos.</li>
            </ul>
            <p className="mt-2">
              Conforme al artículo 26 de la Ley 1581 de 2012, la transferencia internacional de datos
              se realiza a países que cuentan con niveles adecuados de protección o bajo las excepciones
              previstas en la ley.
            </p>
          </section>

          <section>
            <h3 className="text-white font-semibold mb-2">11. Conservación de Datos</h3>
            <p>
              Los datos personales serán conservados durante el tiempo necesario para cumplir con las
              finalidades descritas y las obligaciones legales aplicables, incluyendo las obligaciones
              tributarias previstas en el <strong className="text-white">Estatuto Tributario (Decreto 624 de 1989)</strong>,
              que exige la conservación de documentos contables por un mínimo de
              <strong className="text-white"> cinco (5) años</strong>.
            </p>
          </section>

          <section>
            <h3 className="text-white font-semibold mb-2">12. Cookies y Tecnologías Similares</h3>
            <p>
              La Plataforma utiliza cookies técnicas estrictamente necesarias para el funcionamiento
              del sistema de autenticación (token de sesión). No se utilizan cookies de rastreo,
              publicidad ni analíticas de terceros.
            </p>
          </section>

          <section>
            <h3 className="text-white font-semibold mb-2">13. Incidentes de Seguridad</h3>
            <p>
              En caso de que se presente un incidente de seguridad que comprometa datos personales,
              Monastery Club notificará a los titulares afectados y a la Superintendencia de Industria
              y Comercio conforme a los lineamientos establecidos por la SIC, dentro de los términos
              previstos por la ley.
            </p>
          </section>

          <section>
            <h3 className="text-white font-semibold mb-2">14. Modificaciones a esta Política</h3>
            <p>
              Monastery Club se reserva el derecho de modificar esta Política de Privacidad.
              Los cambios serán informados a los titulares a través de la Plataforma y entrarán
              en vigencia a partir de su publicación.
            </p>
          </section>

          <section>
            <h3 className="text-white font-semibold mb-2">15. Autoridad de Protección de Datos</h3>
            <p>
              La autoridad de vigilancia en materia de protección de datos personales en Colombia es la:
            </p>
            <div className="mt-2 p-3 rounded-lg" style={{ background: 'rgba(212,175,55,0.08)', border: '1px solid rgba(212,175,55,0.15)' }}>
              <p className="text-white font-medium">Superintendencia de Industria y Comercio (SIC)</p>
              <p className="text-white/50 text-xs mt-1">Delegatura para la Protección de Datos Personales</p>
              <p className="text-white/50 text-xs">Carrera 13 No. 27-00, Bogotá D.C., Colombia</p>
              <p className="text-white/50 text-xs">www.sic.gov.co</p>
              <p className="text-white/50 text-xs">Línea gratuita: 018000-910165</p>
            </div>
          </section>

          <section>
            <h3 className="text-white font-semibold mb-2">16. Contacto</h3>
            <p>
              Para consultas, reclamos o solicitudes relacionadas con el tratamiento de datos personales:
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Correo: admin@monastery.co</li>
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
