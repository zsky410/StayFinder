import unittest
from collections import defaultdict
from unittest import mock

from langchain_text_splitters import RecursiveCharacterTextSplitter

from scripts import phase2_rag


def notes_bundle():
    return {
        "city": defaultdict(
            list,
            {
                "da-nang": [
                    {
                        "slug": "da-nang-overview",
                        "title": "Da Nang overview",
                        "subject_kind": "city",
                        "subject_slug": "da-nang",
                        "content": "Da Nang has beach, river, and airport stay zones.",
                        "tags": [],
                        "metadata": {},
                    }
                ]
            },
        ),
        "zone": defaultdict(list),
        "landmark": defaultdict(
            list,
            {
                "dragon-bridge": [
                    {
                        "slug": "dragon-bridge-note",
                        "title": "Dragon Bridge note",
                        "subject_kind": "landmark",
                        "subject_slug": "dragon-bridge",
                        "content": "Dragon Bridge is useful for central nightlife stays.",
                        "tags": [],
                        "metadata": {},
                    }
                ]
            },
        ),
    }


def sample_place():
    return {
        "id": "11111111-1111-1111-1111-111111111111",
        "place_id": "google-place-1",
        "batch_key": "batch",
        "title": "Sample River Hotel",
        "type_slug": "hotel",
        "type_label": "Hotel",
        "category_name": "Hotel",
        "address": "1 Bach Dang",
        "neighborhood": "Hai Chau",
        "district": "Hai Chau",
        "city": "Da Nang",
        "rating": 4.5,
        "reviews_count": 120,
        "description": "Central hotel near the river.",
        "hotel_description": "Rooms for short stays.",
        "price_text": "$$",
        "phone": "+84000000000",
        "website": "https://example.com",
        "amenities": ["Wi-Fi miễn phí", "Phù hợp với trẻ em", "Spa"],
        "landmarks": [
            {
                "slug": "dragon-bridge",
                "name": "Dragon Bridge",
                "distance_m": 450,
                "anchor_label": "east bank",
            }
        ],
        "reviews": [
            {
                "stars": 5,
                "review_text": "Great river location and clean room.",
                "text_translated": None,
                "likes_count": 3,
            }
        ],
    }


class Phase2RagTest(unittest.TestCase):
    def test_builds_separate_chunk_kinds(self):
        docs = phase2_rag.build_raw_documents_for_place(sample_place(), notes_bundle())
        kinds = {doc.metadata["chunk_kind"] for doc in docs}

        self.assertEqual(
            kinds,
            {
                "place_profile",
                "amenity_profile",
                "landmark_proximity",
                "review_snippets",
                "local_context",
            },
        )

    def test_split_documents_keep_section_metadata(self):
        splitter = RecursiveCharacterTextSplitter(chunk_size=180, chunk_overlap=20)
        docs = phase2_rag.build_documents_for_place(sample_place(), notes_bundle(), splitter)

        self.assertGreaterEqual(len(docs), 5)
        for doc in docs:
            self.assertTrue(doc.page_content.strip())
            self.assertIn("chunk_kind", doc.metadata)
            self.assertIn("section_index", doc.metadata)
            self.assertIn("section_chunk_index", doc.metadata)

    def test_parse_structured_intent_extracts_filters(self):
        intent = phase2_rag.parse_structured_intent(
            "khách sạn gần Cầu Rồng có wifi trong 2 km rating 4",
            landmark_aliases={"cau rong": "dragon-bridge"},
            amenity_labels=["Wi-Fi miễn phí"],
        )

        self.assertEqual(intent.type_slugs, ["hotel"])
        self.assertEqual(intent.landmark_slugs, ["dragon-bridge"])
        self.assertEqual(intent.amenity_labels, ["Wi-Fi miễn phí"])
        self.assertEqual(intent.max_distance_m, 2000)
        self.assertEqual(intent.min_rating, 4.0)

    def test_review_summary_falls_back_when_llm_fails(self):
        with mock.patch.object(
            phase2_rag,
            "generate_llm_review_summary",
            side_effect=RuntimeError("llm down"),
        ):
            payload = phase2_rag.generate_review_summary(
                sample_place(),
                model_name="gpt-5.4",
                use_llm=True,
            )

        self.assertEqual(payload["model"], "heuristic-fallback")
        self.assertIn("fallback-after-llm-error", payload["metadata"]["strategy"])
        self.assertIn("llm down", payload["metadata"]["llm_error"])
        self.assertTrue(payload["summary_text"])


if __name__ == "__main__":
    unittest.main()
