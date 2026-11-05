package com.acombsdev.cards.card;

/** A card; its photos are at photos/{photoId}/front.jpg and back.jpg on the UI's host. */
public record CardResponse(String photoId, String certNumber, String sport, Integer year, String setName,
                           String cardNumber, String player, String variety, String grade) {
    static CardResponse from(Card card) {
        return new CardResponse(card.getPhotoId(), card.getCertNumber(), card.getSport(), card.getYear(),
                card.getSetName(), card.getCardNumber(), card.getPlayer(), card.getVariety(), card.getGrade());
    }
}
