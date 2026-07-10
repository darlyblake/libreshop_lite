-- Migration: Ajouter l'indicatif téléphonique à la table countries
-- Cette migration ajoute la colonne phone_code et remplit les pays avec leurs indicatifs

-- Ajouter la colonne phone_code
ALTER TABLE countries 
ADD COLUMN IF NOT EXISTS phone_code VARCHAR(10);

-- Mettre à jour les pays avec leurs indicatifs téléphoniques
UPDATE countries SET phone_code = '+241' WHERE code = 'GA'; -- Gabon
UPDATE countries SET phone_code = '+225' WHERE code = 'CI'; -- Côte d'Ivoire
UPDATE countries SET phone_code = '+237' WHERE code = 'CM'; -- Cameroun
UPDATE countries SET phone_code = '+221' WHERE code = 'SN'; -- Sénégal
UPDATE countries SET phone_code = '+223' WHERE code = 'ML'; -- Mali
UPDATE countries SET phone_code = '+226' WHERE code = 'BF'; -- Burkina Faso
UPDATE countries SET phone_code = '+228' WHERE code = 'TG'; -- Togo
UPDATE countries SET phone_code = '+229' WHERE code = 'BJ'; -- Bénin
UPDATE countries SET phone_code = '+234' WHERE code = 'NG'; -- Nigeria
UPDATE countries SET phone_code = '+242' WHERE code = 'CG'; -- Congo
UPDATE countries SET phone_code = '+243' WHERE code = 'CD'; -- RD Congo
UPDATE countries SET phone_code = '+33' WHERE code = 'FR'; -- France
UPDATE countries SET phone_code = '+1' WHERE code = 'US'; -- États-Unis
UPDATE countries SET phone_code = '+44' WHERE code = 'GB'; -- Royaume-Uni
UPDATE countries SET phone_code = '+49' WHERE code = 'DE'; -- Allemagne
UPDATE countries SET phone_code = '+33' WHERE code = 'BE'; -- Belgique
UPDATE countries SET phone_code = '+41' WHERE code = 'CH'; -- Suisse
UPDATE countries SET phone_code = '+33' WHERE code = 'CA'; -- Canada
UPDATE countries SET phone_code = '+86' WHERE code = 'CN'; -- Chine
UPDATE countries SET phone_code = '+81' WHERE code = 'JP'; -- Japon
UPDATE countries SET phone_code = '+82' WHERE code = 'KR'; -- Corée du Sud
UPDATE countries SET phone_code = '+91' WHERE code = 'IN'; -- Inde
UPDATE countries SET phone_code = '+55' WHERE code = 'BR'; -- Brésil
UPDATE countries SET phone_code = '+54' WHERE code = 'AR'; -- Argentine
UPDATE countries SET phone_code = '+56' WHERE code = 'CL'; -- Chili
UPDATE countries SET phone_code = '+57' WHERE code = 'CO'; -- Colombie
UPDATE countries SET phone_code = '+52' WHERE code = 'MX'; -- Mexique
UPDATE countries SET phone_code = '+34' WHERE code = 'ES'; -- Espagne
UPDATE countries SET phone_code = '+39' WHERE code = 'IT'; -- Italie
UPDATE countries SET phone_code = '+31' WHERE code = 'NL'; -- Pays-Bas
UPDATE countries SET phone_code = '+46' WHERE code = 'SE'; -- Suède
UPDATE countries SET phone_code = '+47' WHERE code = 'NO'; -- Norvège
UPDATE countries SET phone_code = '+45' WHERE code = 'DK'; -- Danemark
UPDATE countries SET phone_code = '+358' WHERE code = 'FI'; -- Finlande
UPDATE countries SET phone_code = '+370' WHERE code = 'LT'; -- Lituanie
UPDATE countries SET phone_code = '+371' WHERE code = 'LV'; -- Lettonie
UPDATE countries SET phone_code = '+372' WHERE code = 'EE'; -- Estonie
UPDATE countries SET phone_code = '+48' WHERE code = 'PL'; -- Pologne
UPDATE countries SET phone_code = '+420' WHERE code = 'CZ'; -- République tchèque
UPDATE countries SET phone_code = '+421' WHERE code = 'SK'; -- Slovaquie
UPDATE countries SET phone_code = '+36' WHERE code = 'HU'; -- Hongrie
UPDATE countries SET phone_code = '+40' WHERE code = 'RO'; -- Roumanie
UPDATE countries SET phone_code = '+359' WHERE code = 'BG'; -- Bulgarie
UPDATE countries SET phone_code = '+385' WHERE code = 'HR'; -- Croatie
UPDATE countries SET phone_code = '+381' WHERE code = 'RS'; -- Serbie
UPDATE countries SET phone_code = '+387' WHERE code = 'BA'; -- Bosnie
UPDATE countries SET phone_code = '+389' WHERE code = 'MK'; -- Macédoine du Nord
UPDATE countries SET phone_code = '+386' WHERE code = 'SI'; -- Slovénie
UPDATE countries SET phone_code = '+380' WHERE code = 'UA'; -- Ukraine
UPDATE countries SET phone_code = '+375' WHERE code = 'BY'; -- Biélorussie
UPDATE countries SET phone_code = '+374' WHERE code = 'AM'; -- Arménie
UPDATE countries SET phone_code = '+994' WHERE code = 'AZ'; -- Azerbaïdjan
UPDATE countries SET phone_code = '+998' WHERE code = 'UZ'; -- Ouzbékistan
UPDATE countries SET phone_code = '+996' WHERE code = 'KG'; -- Kirghizistan
UPDATE countries SET phone_code = '+993' WHERE code = 'TM'; -- Turkménistan
UPDATE countries SET phone_code = '+992' WHERE code = 'TJ'; -- Tadjikistan
UPDATE countries SET phone_code = '+7' WHERE code = 'KZ'; -- Kazakhstan
UPDATE countries SET phone_code = '+90' WHERE code = 'TR'; -- Turquie
UPDATE countries SET phone_code = '+30' WHERE code = 'GR'; -- Grèce
UPDATE countries SET phone_code = '+351' WHERE code = 'PT'; -- Portugal
UPDATE countries SET phone_code = '+353' WHERE code = 'IE'; -- Irlande
UPDATE countries SET phone_code = '+352' WHERE code = 'LU'; -- Luxembourg
UPDATE countries SET phone_code = '+357' WHERE code = 'CY'; -- Chypre
UPDATE countries SET phone_code = '+966' WHERE code = 'SA'; -- Arabie saoudite
UPDATE countries SET phone_code = '+971' WHERE code = 'AE'; -- Émirats arabes unis
UPDATE countries SET phone_code = '+974' WHERE code = 'QA'; -- Qatar
UPDATE countries SET phone_code = '+973' WHERE code = 'BH'; -- Bahreïn
UPDATE countries SET phone_code = '+965' WHERE code = 'KW'; -- Koweït
UPDATE countries SET phone_code = '+968' WHERE code = 'OM'; -- Oman
UPDATE countries SET phone_code = '+971' WHERE code = 'YE'; -- Yémen
UPDATE countries SET phone_code = '+964' WHERE code = 'IQ'; -- Irak
UPDATE countries SET phone_code = '+963' WHERE code = 'SY'; -- Syrie
UPDATE countries SET phone_code = '+962' WHERE code = 'JO'; -- Jordanie
UPDATE countries SET phone_code = '+970' WHERE code = 'PS'; -- Palestine
UPDATE countries SET phone_code = '+972' WHERE code = 'IL'; -- Israël
UPDATE countries SET phone_code = '+20' WHERE code = 'EG'; -- Égypte
UPDATE countries SET phone_code = '+213' WHERE code = 'DZ'; -- Algérie
UPDATE countries SET phone_code = '+212' WHERE code = 'MA'; -- Maroc
UPDATE countries SET phone_code = '+216' WHERE code = 'TN'; -- Tunisie
UPDATE countries SET phone_code = '+218' WHERE code = 'LY'; -- Libye
UPDATE countries SET phone_code = '+251' WHERE code = 'ET'; -- Éthiopie
UPDATE countries SET phone_code = '+254' WHERE code = 'KE'; -- Kenya
UPDATE countries SET phone_code = '+255' WHERE code = 'TZ'; -- Tanzanie
UPDATE countries SET phone_code = '+256' WHERE code = 'UG'; -- Ouganda
UPDATE countries SET phone_code = '+257' WHERE code = 'BI'; -- Burundi
UPDATE countries SET phone_code = '+258' WHERE code = 'MZ'; -- Mozambique
UPDATE countries SET phone_code = '+260' WHERE code = 'ZM'; -- Zambie
UPDATE countries SET phone_code = '+263' WHERE code = 'ZW'; -- Zimbabwe
UPDATE countries SET phone_code = '+264' WHERE code = 'NA'; -- Namibie
UPDATE countries SET phone_code = '+265' WHERE code = 'MW'; -- Malawi
UPDATE countries SET phone_code = '+266' WHERE code = 'LS'; -- Lesotho
UPDATE countries SET phone_code = '+267' WHERE code = 'BW'; -- Botswana
UPDATE countries SET phone_code = '+268' WHERE code = 'SZ'; -- Eswatini
UPDATE countries SET phone_code = '+269' WHERE code = 'KM'; -- Comores
UPDATE countries SET phone_code = '+250' WHERE code = 'RW'; -- Rwanda
UPDATE countries SET phone_code = '+27' WHERE code = 'ZA'; -- Afrique du Sud
UPDATE countries SET phone_code = '+236' WHERE code = 'CF'; -- Centrafrique
UPDATE countries SET phone_code = '+235' WHERE code = 'TD'; -- Tchad
UPDATE countries SET phone_code = '+240' WHERE code = 'GQ'; -- Guinée équatoriale
UPDATE countries SET phone_code = '+245' WHERE code = 'GW'; -- Guinée-Bissau
UPDATE countries SET phone_code = '+244' WHERE code = 'AO'; -- Angola
UPDATE countries SET phone_code = '+258' WHERE code = 'MZ'; -- Mozambique
UPDATE countries SET phone_code = '+261' WHERE code = 'MG'; -- Madagascar
UPDATE countries SET phone_code = '+262' WHERE code = 'RE'; -- Réunion
UPDATE countries SET phone_code = '+262' WHERE code = 'YT'; -- Mayotte
UPDATE countries SET phone_code = '+230' WHERE code = 'MU'; -- Maurice
UPDATE countries SET phone_code = '+258' WHERE code = 'SC'; -- Seychelles
UPDATE countries SET phone_code = '+240' WHERE code = 'ST'; -- Sao Tomé-et-Principe
UPDATE countries SET phone_code = '+239' WHERE code = 'CV'; -- Cap-Vert
UPDATE countries SET phone_code = '+351' WHERE code = 'PT'; -- Portugal (Açores/Madeire)
