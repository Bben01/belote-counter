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
- `Nous contrat 100, points 120` : le label `contrat` identifie l'annonce.

Les points de cartes sont compris entre 0 et 162, hors belote. Les contrats
170/180 déclarés « faits » nécessitent donc la belote du preneur.

## Tests

Exécuter `deno test` à la racine du projet.

