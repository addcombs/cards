package com.acombsdev.cards.card;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
// The schema comes from DATABASE_SCHEMA (hibernate.default_schema in application.properties).
// db/migrations/002-cards.sql adds the collection; admins edit the cards' details through the API.
@Table(name = "cards")
public class Card {
    @Id
    private Integer id;

    @Column(name = "photo_id")
    private String photoId;

    @Column(name = "cert_number")
    private String certNumber;

    @Column(name = "sport")
    private String sport;

    @Column(name = "year")
    private Integer year;

    @Column(name = "set_name")
    private String setName;

    @Column(name = "card_number")
    private String cardNumber;

    @Column(name = "player")
    private String player;

    @Column(name = "variety")
    private String variety;

    @Column(name = "grade")
    private String grade;

    @Column(name = "ebay_url")
    private String ebayUrl;

    protected Card() {
    }

    Card(String photoId, String certNumber, String sport, Integer year, String setName, String cardNumber,
         String player, String variety, String grade) {
        this.photoId = photoId;
        this.certNumber = certNumber;
        this.sport = sport;
        this.year = year;
        this.setName = setName;
        this.cardNumber = cardNumber;
        this.player = player;
        this.variety = variety;
        this.grade = grade;
    }

    void update(CardRequest request) {
        this.certNumber = blankToNull(request.certNumber());
        this.sport = request.sport();
        this.year = request.year();
        this.setName = request.setName().trim();
        this.cardNumber = request.cardNumber().trim();
        this.player = request.player().trim();
        this.variety = blankToNull(request.variety());
        this.grade = blankToNull(request.grade());
        this.ebayUrl = blankToNull(request.ebayUrl());
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    public Integer getId() {
        return id;
    }

    public String getPhotoId() {
        return photoId;
    }

    public String getCertNumber() {
        return certNumber;
    }

    public String getSport() {
        return sport;
    }

    public Integer getYear() {
        return year;
    }

    public String getSetName() {
        return setName;
    }

    public String getCardNumber() {
        return cardNumber;
    }

    public String getPlayer() {
        return player;
    }

    public String getVariety() {
        return variety;
    }

    public String getGrade() {
        return grade;
    }

    public String getEbayUrl() {
        return ebayUrl;
    }
}
