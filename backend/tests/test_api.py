"""End-to-end tests of the HTTP API against the seeded sample data."""


def new_form(client, *question_types):
    form = client.post("/api/forms", json={"title": "Test form"}).json()
    questions = [
        client.post(f"/api/forms/{form['id']}/questions", json={"type": qtype}).json() for qtype in question_types
    ]
    return form, questions


def test_seed_gives_two_published_forms_with_responses(client):
    forms = client.get("/api/forms").json()
    published = [f for f in forms if f["status"] == "published"]
    assert len(forms) == 3
    assert len(published) == 2
    assert all(f["response_count"] > 0 for f in published)


def test_questions_are_added_in_order_and_can_be_reordered(client):
    form, (first, second, third) = new_form(client, "short_text", "email", "rating")
    assert [q["position"] for q in (first, second, third)] == [0, 1, 2]

    new_order = [third["id"], first["id"], second["id"]]
    response = client.put(f"/api/forms/{form['id']}/questions/order", json={"question_ids": new_order})
    assert response.status_code == 200

    saved = client.get(f"/api/forms/{form['id']}").json()["questions"]
    assert [q["id"] for q in saved] == new_order


def test_reorder_rejects_a_list_that_does_not_match_the_form(client):
    form, (first, _second) = new_form(client, "short_text", "email")
    response = client.put(f"/api/forms/{form['id']}/questions/order", json={"question_ids": [first["id"]]})
    assert response.status_code == 400


def test_choice_question_gets_default_options_and_keeps_ids_on_edit(client):
    _form, (question,) = new_form(client, "multiple_choice")
    kept = question["options"][0]

    edited = client.patch(
        f"/api/questions/{question['id']}",
        json={"options": [{"id": kept["id"], "label": "Renamed"}, {"label": "Brand new"}]},
    ).json()

    assert [o["label"] for o in edited["options"]] == ["Renamed", "Brand new"]
    assert edited["options"][0]["id"] == kept["id"]


def test_changing_type_away_from_choice_drops_the_options(client):
    _form, (question,) = new_form(client, "dropdown")
    edited = client.patch(f"/api/questions/{question['id']}", json={"type": "rating"}).json()
    assert edited["options"] == []
    assert edited["settings"]["max"] == 5


def test_draft_is_not_public_until_published(client):
    form, _ = new_form(client, "short_text")
    assert client.get(f"/api/public/forms/{form['slug']}").status_code == 404

    client.post(f"/api/forms/{form['id']}/publish")
    assert client.get(f"/api/public/forms/{form['slug']}").status_code == 200

    client.post(f"/api/forms/{form['id']}/unpublish")
    assert client.get(f"/api/public/forms/{form['slug']}").status_code == 404


def test_empty_form_cannot_be_published(client):
    form, _ = new_form(client)
    assert client.post(f"/api/forms/{form['id']}/publish").status_code == 400


def test_submission_is_validated_on_the_server(client):
    form, (name, email, rating) = new_form(client, "short_text", "email", "rating")
    client.patch(f"/api/questions/{name['id']}", json={"required": True})
    client.post(f"/api/forms/{form['id']}/publish")

    response = client.post(
        f"/api/public/forms/{form['slug']}/responses",
        json={"answers": [{"question_id": email["id"], "value": "nope"}, {"question_id": rating["id"], "value": 9}]},
    )

    assert response.status_code == 422
    assert set(response.json()["errors"]) == {str(name["id"]), str(email["id"]), str(rating["id"])}
    assert client.get(f"/api/forms/{form['id']}/responses").json() == []


def test_valid_submission_is_stored_and_counted_in_stats(client):
    form, (choice, rating) = new_form(client, "multiple_choice", "rating")
    client.post(f"/api/forms/{form['id']}/publish")
    picked = choice["options"][1]

    for stars in (2, 4):
        response = client.post(
            f"/api/public/forms/{form['slug']}/responses",
            json={"answers": [{"question_id": choice["id"], "value": picked["id"]}, {"question_id": rating["id"], "value": stars}]},
        )
        assert response.status_code == 201

    stats = client.get(f"/api/forms/{form['id']}/stats").json()
    choice_stats, rating_stats = stats["questions"]
    assert stats["response_count"] == 2
    assert {c["label"]: c["count"] for c in choice_stats["counts"]} == {"Choice 1": 0, "Choice 2": 2}
    assert rating_stats["average"] == 3.0


def test_answer_survives_deleting_the_option_that_was_picked(client):
    form, (choice,) = new_form(client, "multiple_choice")
    client.post(f"/api/forms/{form['id']}/publish")
    picked, other = choice["options"]
    client.post(
        f"/api/public/forms/{form['slug']}/responses",
        json={"answers": [{"question_id": choice["id"], "value": picked["id"]}]},
    )

    client.patch(f"/api/questions/{choice['id']}", json={"options": [{"id": other["id"], "label": other["label"]}]})

    (stored,) = client.get(f"/api/forms/{form['id']}/responses").json()
    assert stored["answers"][0]["value"] == picked["label"]


def test_duplicate_copies_questions_but_not_responses(client):
    original = next(f for f in client.get("/api/forms").json() if f["response_count"] > 0)
    copy = client.post(f"/api/forms/{original['id']}/duplicate").json()

    assert copy["status"] == "draft"
    assert copy["slug"] != original["slug"]
    assert len(copy["questions"]) == original["question_count"]
    assert client.get(f"/api/forms/{copy['id']}/responses").json() == []


def test_deleting_a_form_removes_its_responses(client):
    original = next(f for f in client.get("/api/forms").json() if f["response_count"] > 0)
    response_id = client.get(f"/api/forms/{original['id']}/responses").json()[0]["id"]

    assert client.delete(f"/api/forms/{original['id']}").status_code == 204
    assert client.get(f"/api/responses/{response_id}").status_code == 404
