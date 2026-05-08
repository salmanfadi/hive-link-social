-- Make signup trigger robust and extension-independent.
-- Prevents "Database error saving new user" when random-bytes extension path differs.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
DECLARE
  base_username text;
  final_username text;
  counter int := 0;
BEGIN
  base_username := lower(
    regexp_replace(
      coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
      '[^a-z0-9_]',
      '',
      'g'
    )
  );

  IF base_username = '' THEN
    base_username := 'user';
  END IF;

  final_username := base_username;
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = final_username) LOOP
    counter := counter + 1;
    final_username := base_username || counter::text;
  END LOOP;

  INSERT INTO public.profiles (id, username, display_name, did, public_key)
  VALUES (
    new.id,
    final_username,
    coalesce(new.raw_user_meta_data->>'display_name', final_username),
    'did:hivelink:' || replace(new.id::text, '-', ''),
    replace(new.id::text, '-', '')
  );

  RETURN new;
END;
$function$;
