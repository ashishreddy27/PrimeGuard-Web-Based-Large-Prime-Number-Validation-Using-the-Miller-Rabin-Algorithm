
CREATE DATABASE primesbase;
\c primesbase

CREATE TABLE prime (
  id serial PRIMARY KEY,
  num bigint,
  dif integer
);

CREATE TABLE composite (
  id serial PRIMARY KEY,
  num bigint,
  factor bigint,
  power bigint
);

--Obs: bigint  8 bytes  large-range integer  -9223372036854775808 to 9223372036854775807

CREATE OR REPLACE FUNCTION check_prime(init int)
RETURNS BOOLEAN AS $$
DECLARE 
  divisible BOOLEAN := false;
  p RECORD;
  n BIGINT;
BEGIN

n:=trunc(|/init); --Integer square root of init.

FOR p IN SELECT num FROM prime WHERE num <= n ORDER BY num
LOOP

--Test if init is divisible by p.num

IF init % p.num = 0 THEN
  divisible:=true;
END IF;

END LOOP;

IF divisible='false' THEN
  RAISE NOTICE  'Finded prime: %', init;
  EXECUTE 'INSERT INTO prime (num) VALUES ('||init||')';
END IF;

RETURN divisible;
END;
$$  LANGUAGE plpgsql;


CREATE OR REPLACE FUNCTION check_prime_interval(init int, finish int)
RETURNS VOID AS $$
BEGIN

WHILE init <= finish LOOP

    PERFORM * FROM prime WHERE prime.num = init;
    IF FOUND THEN
      RAISE EXCEPTION '% Já está calculado !!', init;
    END IF;

    RAISE NOTICE  'Checar: %', init;
    PERFORM check_prime(init);
    init := init+1;
END LOOP;

END;
$$  LANGUAGE plpgsql;


--------

TRUNCATE TABLE prime;

--Insert the firsts prime numbers
INSERT INTO prime VALUES
(1,2),
(2,3),
(3,5),
(4,7),
(5,11);

ALTER SEQUENCE prime_id_seq RESTART WITH 6;

CREATE OR REPLACE FUNCTION calc_dif()
RETURNS VOID AS $$
DECLARE
   a RECORD;     
   b RECORD;  
   aid INTEGER;
   calc INTEGER;                   
BEGIN
  FOR a IN SELECT id,num FROM prime WHERE dif is null order by id
  LOOP 
    aid := a.id - 1;
    FOR b IN SELECT id,num FROM prime WHERE id = aid
    LOOP                
      calc := a.num-b.num;

      EXECUTE 'UPDATE prime SET dif = '||calc||' WHERE id = '||a.id;

    END LOOP;
  END LOOP;
END;
$$ LANGUAGE plpgsql;



CREATE OR REPLACE FUNCTION check_composite(n BIGINT, sub_factor BIGINT DEFAULT 0)
RETURNS VOID AS $$
DECLARE
   a RECORD;     
   p RECORD;   
   r BIGINT; -- division result        

BEGIN

  /*
   The algorithm goes through the list of prime numbers until it finds the one that is divisible.
   Then divide the number by the prime number and repeat the process.
   The factors and their power are saved in the database.
  */

  IF sub_factor = 0 THEN
    PERFORM * FROM composite WHERE composite.num = n;

    IF FOUND THEN
      RAISE EXCEPTION '% Já está calculado !!', n;
    END IF;
  END IF;

  IF n = 0 OR n = 1 OR sub_factor = 1 THEN
    RAISE NOTICE '0 ou 1 nao eh decomposto';
    RETURN;
  END IF;

  PERFORM * FROM prime WHERE prime.num = n;

  IF FOUND THEN
    RAISE NOTICE '% eh um numero primo !!', n;
    RETURN;
  END IF;


  PERFORM * FROM prime WHERE prime.num = sub_factor;

  IF FOUND THEN

      PERFORM * FROM composite WHERE num = n AND factor = sub_factor;
      IF FOUND THEN
    
        EXECUTE 'UPDATE composite SET power = coalesce(power,0)+1 WHERE num = '||n||' AND factor = '||sub_factor;
      ELSE

        EXECUTE 'INSERT INTO composite (num,factor,power) VALUES ('||n||','||sub_factor||',1)';
      END IF;

  ELSE
  
    --Se chegou ate aqui, nao eh numero primo

    FOR p IN SELECT num FROM prime order by id
    LOOP                
      --Se n for divisivel pelo primo
      IF (sub_factor = 0 AND n % p.num = 0) OR (sub_factor != 0 AND sub_factor % p.num = 0) THEN
  
        PERFORM * FROM composite WHERE num = n AND factor = p.num;
        IF FOUND THEN
    
          EXECUTE 'UPDATE composite SET power = coalesce(power,0)+1 WHERE num = '||n||' AND factor = '||p.num;
        ELSE
  
          EXECUTE 'INSERT INTO composite (num,factor,power) VALUES ('||n||','||p.num||',1)';
        END IF;

        IF sub_factor = 0 THEN
          r := n / p.num;
        ELSE
          r := sub_factor / p.num;
        END IF;

        IF r != 1 THEN

          PERFORM check_composite(n, r);
          EXIT;
        ELSE
          EXIT;
        END IF;

      END IF;

    END LOOP;

  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION check_composite_interval(init int, finish int)
RETURNS VOID AS $$
BEGIN

WHILE init <= finish LOOP
    RAISE NOTICE  'Check: %', init;
    PERFORM check_composite(init);
    init := init+1;
END LOOP;

END;
$$  LANGUAGE plpgsql;


