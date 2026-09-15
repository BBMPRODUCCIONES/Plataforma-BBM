-- Devolver a los administradores el acceso a las paginas de administracion.
--
-- Las cinco banderas puede_acceder_* se guardan desde la pantalla de Usuarios.
-- Si una se desmarca por accidente, la ruta correspondiente responde
-- "Acceso Denegado" sin decir por que. Eso fue lo que paso con Constructor.
--
-- Nota: role es un enum (app_role), por eso el filtro compara role::text y no
-- lower(role): esa funcion no existe para el tipo.
-- Un administrador, por definicion, tiene acceso completo: aqui se restablece
-- para todos los administradores actuales.
UPDATE public.user_roles
SET puede_acceder_usuarios    = true,
    puede_acceder_clientes    = true,
    puede_acceder_empleados   = true,
    puede_acceder_constructor = true,
    puede_acceder_agentes     = true
WHERE role::text = 'administrador';

-- Comprobacion: las cinco columnas deben quedar en true.
SELECT email,
       role,
       puede_acceder_usuarios,
       puede_acceder_clientes,
       puede_acceder_empleados,
       puede_acceder_constructor,
       puede_acceder_agentes
FROM public.user_roles
WHERE role::text = 'administrador'
ORDER BY email;
