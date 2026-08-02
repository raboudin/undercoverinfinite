export interface WordPair {
  a: string
  b: string
}

/**
 * Chaque paire tient deux mots proches mais distincts : les civils reçoivent
 * l'un, les undercovers l'autre. Le camp qui hérite de `a` plutôt que de `b`
 * est tiré au sort à chaque partie — sinon les undercovers récupéreraient
 * toujours le même côté de la liste.
 */
export const wordPairs: WordPair[] = [
  { a: 'Café', b: 'Thé' },
  { a: 'Avion', b: 'Hélicoptère' },
  { a: 'Chien', b: 'Loup' },
  { a: 'Passeport', b: 'Visa' },
  { a: 'Valise', b: 'Sac à dos' },
  { a: 'Pluie', b: 'Neige' },
  { a: 'Guitare', b: 'Violon' },
  { a: 'Métro', b: 'Tramway' },
  { a: 'Journal', b: 'Magazine' },
  { a: 'Montre', b: 'Horloge' },
  { a: 'Téléphone', b: 'Radio' },
  { a: 'Miroir', b: 'Fenêtre' },
  { a: 'Bougie', b: 'Lampe' },
  { a: 'Pont', b: 'Tunnel' },
  { a: 'Clé', b: 'Cadenas' },
  { a: 'Ombre', b: 'Reflet' },
  { a: 'Lettre', b: 'Colis' },
  { a: 'Ambassade', b: 'Consulat' },
  { a: 'Détective', b: 'Journaliste' },
  { a: 'Code', b: 'Mot de passe' },
  { a: 'Frontière', b: 'Douane' },
  { a: 'Bibliothèque', b: 'Archives' },
  { a: 'Manteau', b: 'Imperméable' },
  { a: 'Chapeau', b: 'Casquette' },
  { a: 'Cigarette', b: 'Pipe' },
  { a: 'Whisky', b: 'Vodka' },
  { a: 'Train', b: 'Bus' },
  { a: 'Hôtel', b: 'Auberge' },
  { a: 'Carte', b: 'Boussole' },
  { a: 'Jumelles', b: 'Longue-vue' },
  { a: 'Micro', b: 'Caméra' },
  { a: 'Serrure', b: 'Coffre-fort' },
  { a: 'Brouillard', b: 'Fumée' },
  { a: 'Mur', b: 'Clôture' },
  { a: 'Signature', b: 'Empreinte' },
  { a: 'Rumeur', b: 'Ragot' },
  { a: 'Silence', b: 'Chuchotement' },
  { a: 'Piano', b: 'Accordéon' },
  { a: 'Échecs', b: 'Dames' },
  { a: 'Parapluie', b: 'Canne' },
  { a: 'Aéroport', b: 'Gare' },
  { a: 'Bateau', b: 'Sous-marin' },
  { a: 'Satellite', b: 'Antenne' },
  { a: 'Encre', b: 'Crayon' },
  { a: 'Masque', b: 'Perruque' },
  { a: 'Poison', b: 'Venin' },
  { a: 'Trahison', b: 'Mensonge' },
  { a: 'Uniforme', b: 'Costume' },
  { a: 'Médaille', b: 'Trophée' },
  { a: 'Quai', b: 'Ponton' }
]
