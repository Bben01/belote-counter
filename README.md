# Belote Counter

Live app (GitHub Pages): https://bben01.github.io/belote-counter/

## Saisie des donnes

- `Nous 120 fait` : contrat réussi. Sans score précis, les points de cartes sont
	le minimum nécessaire pour réussir (120 ici, ou 100 avec la belote du preneur).
	Pour un score exact, indiquez toujours les points.
- Réussite : `fait`, `faite`, `réussi`, `rempli`, `réalisé`, `gagné`, `passé`,
	`honoré`, `accompli`, `ok` (accents et majuscules facultatifs).
- Chute : `chute`, `chuté`, `dedans`, `perdu`, `raté`, `loupé`, `tombé`,
	`manqué`, `échec`, `pas fait`, `non réussi`. Une chute explicite est prioritaire.
- `Nous 100 fait 80` : 80 points du preneur, pas une déclaration de réussite.
	Les points explicites déterminent si le contrat est réussi.
- `Nous 100 défense 62` / `Eux 100 nous 62` : 100 points du preneur.
	Les labels `preneur`, `défense`, `points` et `pts` sont reconnus.
- `Nous 100 65` conserve la saisie courte : un score non attribué inférieur
	à 82 est interprété comme les points de la défense.
- Équipes : `nous`, `on`, `notre équipe`, `notre camp` ; `eux`, `ils`, `elles`,
	`adv`, `adversaires`, `les autres`, `leur équipe`, `leur camp`.
- `belote`, `rebelote`, `belote à nous`, `belote pour eux`, `belote défense`,
	`nous avons la belote` ; `sans belote` et `pas de belote` n'ajoutent rien.
- `coinche`, `coinché`, `coinchée`, `cc`, `contré` ; `surcoinche`,
	`sur-coinché`, `sur coinchée`, `sur`, `sc`, `surcontré`.
	`pas coinché` et `non surcoinché` désactivent le modificateur concerné.
- `Nous capot fait`, `Eux capot raté`, ou contrats numériques `250` / `270`.
- `Eux 120 capot` : contrat de 120 conservé + 250 pour le capot = **370**.
	`Eux 120 capot belote` ajoute 20, soit **390**. La belote n'est pas multipliée
	par la coinche. Sans contrat annoncé, `Eux capot` conserve le contrat par défaut
	de 250 (500 points, ou 520 avec belote).
- Capot de la défense : `Nous 100 eux capot`, `capot pour eux`, `défense capot`,
	`capot inversé`, `contre-capot`. La défense marque 250 + contrat (× coinche),
	soit **350** pour `Nous 100 eux capot`.
- `Nous contrat 100, points 120` : le label `contrat` identifie l'annonce.
- Coinche / surcoinche : l'équipe gagnante marque 162 + contrat × 2 (× 4), et
	prend la belote ; l'autre équipe marque 0. `Eux 90 belote coinche fait` = **362**.
	En capot coinché, le capot vaut toujours 250 (au lieu de 162).
- Score manuel : une saisie commençant par `=` contourne l'analyse.
	`= 120 42` (Nous puis Eux), `= eux 360`, `= nous -20 eux 20`.

Les points de cartes sont compris entre 0 et 162, hors belote. Les contrats
170/180 déclarés « faits » nécessitent donc la belote du preneur.

## Modifier une donne

Sur ordinateur, boutons crayon / corbeille dans l'historique. Sur mobile, glisser
une donne vers la gauche (ou la toucher) pour afficher Modifier / Supprimer.
Modifier recharge la saisie dans le champ ; toute la partie est recalculée.
Chaque suppression ou modification peut être annulée pendant 5 secondes.

## Réglages

Bouton réglages en haut à droite. Les règles sont désactivées par défaut et
s'appliquent à toute la partie (recalcul immédiat) :

- Arrondir à la dizaine : points de cartes arrondis, total de 160 au lieu de 162.
- Le preneur doit faire 82 : contrat requis = max(contrat, 82), belote comprise.
- Belote gardée en cas de chute : hors coinche, le preneur conserve ses 20 points.

Aussi : objectif, nouvelle partie, thème (auto / clair / sombre), vibrations.

## Tests

Exécuter `deno test` à la racine du projet.

