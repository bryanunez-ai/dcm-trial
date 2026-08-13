# 0
Inicié con 3 archivos MD después de una sesión de planificación usando el chat de Claude para aterrizar ideas y definir las características del proyecto. El CLAUDE.md con instrucciones claras para Claude y contexto general de las especificaciones del proyecto. El SPEC.md con especificaciones detalladas del proyecto y el plan a seguir para construirlo. Finalmente, el PROMPT.md con el prompt inicial con las instrucciones para que Claude empiece a construir.

Mi idea para el proyecto era un sitio que ayudará a tener analíticas reales del tráfico en un sitio web y tener insights para mejorarlo usando IA. La descripción del proyecto solicitaba sample data, pero quise ir más allá y construir algo real.

# 1
Inicié una sesión en Claude Code desde VS Code donde coloqué el prompt inicial en Plan Mode para que primero Claude hiciera un plan propio para arrancar con la construicción del proyecto. Después de obtener el plan y definir algunos detalles técnicos, aprové el plan y Claude comenzó a construir.

A partir de ese momento, la conversación con Claude fue más sencilla. Al terminar un To Do, me actualizaba y me indicaba el siguient paso de acuerdo al Spec. Revisaba el progreso y si todo andaba bien, le daba la indicación para que continuara al siguiente paso y así hasta completar la construcción de acuerdo al Spec.

Como parte del proyecto, decidí usar Neon en lugar de Supabase, ya que el repositorio original ya maneja Auth y JWT, por lo que opté por aprovecharlo en lugar de eliminarlo. Neon ofrece una base de datos en postgres para que el dashboard pueda funcionar.

# 2
Al terminar de construir todo lo del Spec, procedí a ir a Vercel donde saqué a producción el proyecto ya que Vercel permite hacerlo de una manera sencilla y rápida. En Vercel configuré las variables de entorno y lo saqué a producción.

# Final Thoughts
En ocasiones, trabajar con AI Asisted Development puede ser algo complicado. Sin embargo, cuando se planifica bien un proyecto y se definen a detalles técnicos, la arquitectura y el alcance del mismo, se pueden aprovechar las capacidades de la IA para mejorar la eficiencia y productividad al desarrollar software. Además, tener un plan sólido, ayuda a eficientar el consumo de tokens, lo cual permite usar los límites de consumo de una manera más productiva, reduciendo costos operativos.

Con más tiempo, podría crear un SaaS completo, incorporando pasarela de pago, reportes programados, informes automáticos por correo electrónico, entre otras cosas.

